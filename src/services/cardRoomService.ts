import { auth, isFirestoreConfigured } from '../firebase';
import type {
  CardActionPayload,
  CardGameId,
  CardGameSettingsMap,
  CardRoomClientState,
} from '../types/cardGames';
import type { PlayerAvatar, SignalPayload } from '../types/game';

export interface CardRoomCallbacks {
  onState: (state: CardRoomClientState) => void;
  onSignal: (signal: SignalPayload) => void;
  onError?: (code: string) => void;
}

const STORAGE_KEY_PREFIX = 'pa_cards_active_room_';

export function saveActiveCardRoomCode(uid: string, code: string | null) {
  try {
    const key = `${STORAGE_KEY_PREFIX}${uid}`;
    if (!code) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, code);
    }
  } catch {
    // Ignore storage errors
  }
}

export function loadActiveCardRoomCode(uid: string): string | null {
  try {
    return localStorage.getItem(`${STORAGE_KEY_PREFIX}${uid}`);
  } catch {
    return null;
  }
}

async function buildAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (isFirestoreConfigured() && auth.currentUser) {
    const token = await auth.currentUser.getIdToken();
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function postJson<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const headers = await buildAuthHeaders();
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { code?: string } & T;
  if (!res.ok) {
    throw new Error(data.code || `HTTP_${res.status}`);
  }
  return data;
}

class CardRoomService {
  private eventSource: EventSource | null = null;
  private activeCode: string | null = null;
  private callbacks: CardRoomCallbacks | null = null;
  private myUid: string | null = null;

  private async openEventStream(code: string, uid: string) {
    this.closeStream();
    let token = '';
    if (isFirestoreConfigured() && auth.currentUser) {
      token = await auth.currentUser.getIdToken();
    }
    const qs = new URLSearchParams({ playerId: uid });
    if (token) qs.set('token', token);

    const es = new EventSource(`/api/card-rooms/${code}/events?${qs.toString()}`);
    this.eventSource = es;

    es.addEventListener('card_room_state', (evt: MessageEvent) => {
      try {
        const nextState = JSON.parse(evt.data) as CardRoomClientState;
        this.callbacks?.onState(nextState);
      } catch {
        // Ignore malformed SSE payload
      }
    });

    es.addEventListener('card_signal', (evt: MessageEvent) => {
      try {
        const sig = JSON.parse(evt.data) as SignalPayload;
        this.callbacks?.onSignal(sig);
      } catch {
        // Ignore malformed signal payload
      }
    });

    es.onerror = () => {
      if (this.eventSource?.readyState === EventSource.CLOSED) {
        this.callbacks?.onError?.('DISCONNECTED');
      }
    };
  }

  private closeStream() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  async createRoom(
    code: string,
    selectedGame: CardGameId,
    player: { id: string; name: string; avatar: PlayerAvatar },
    callbacks: CardRoomCallbacks
  ): Promise<CardRoomClientState> {
    this.cleanup();
    this.callbacks = callbacks;
    this.activeCode = code;
    this.myUid = player.id;

    const data = await postJson<{ state: CardRoomClientState }>('/api/card-rooms', {
      code,
      selectedGame,
      player,
    });
    saveActiveCardRoomCode(player.id, code);
    callbacks.onState(data.state);
    await this.openEventStream(code, player.id);
    return data.state;
  }

  async joinRoom(
    code: string,
    player: { id: string; name: string; avatar: PlayerAvatar },
    callbacks: CardRoomCallbacks
  ): Promise<CardRoomClientState> {
    this.cleanup();
    const cleanCode = code.toUpperCase().trim();
    this.callbacks = callbacks;
    this.activeCode = cleanCode;
    this.myUid = player.id;

    const data = await postJson<{ state: CardRoomClientState }>(
      `/api/card-rooms/${cleanCode}/join`,
      { player }
    );
    saveActiveCardRoomCode(player.id, cleanCode);
    callbacks.onState(data.state);
    await this.openEventStream(cleanCode, player.id);
    return data.state;
  }

  async findActiveRejoinRoom(uid: string): Promise<CardRoomClientState | null> {
    const saved = loadActiveCardRoomCode(uid);
    if (!saved) return null;
    try {
      const headers = await buildAuthHeaders();
      const res = await fetch(
        `/api/card-rooms/${saved}?playerId=${encodeURIComponent(uid)}`,
        { headers }
      );
      if (!res.ok) {
        saveActiveCardRoomCode(uid, null);
        return null;
      }
      const data = (await res.json()) as { state: CardRoomClientState };
      return data.state;
    } catch {
      return null;
    }
  }

  async setReady(code: string, uid: string, ready: boolean): Promise<CardRoomClientState> {
    const data = await postJson<{ state: CardRoomClientState }>(
      `/api/card-rooms/${code}/ready`,
      { ready, playerId: uid }
    );
    this.callbacks?.onState(data.state);
    return data.state;
  }

  async updateConfig(
    code: string,
    uid: string,
    payload: {
      selectedGame?: CardGameId;
      settings?: Partial<CardGameSettingsMap>;
    }
  ): Promise<CardRoomClientState> {
    const data = await postJson<{ state: CardRoomClientState }>(
      `/api/card-rooms/${code}/config`,
      { ...payload, playerId: uid }
    );
    this.callbacks?.onState(data.state);
    return data.state;
  }

  async startGame(code: string, uid: string): Promise<CardRoomClientState> {
    const data = await postJson<{ state: CardRoomClientState }>(
      `/api/card-rooms/${code}/start`,
      { playerId: uid }
    );
    this.callbacks?.onState(data.state);
    return data.state;
  }

  async sendAction(
    code: string,
    uid: string,
    action: CardActionPayload
  ): Promise<CardRoomClientState> {
    const data = await postJson<{ state: CardRoomClientState }>(
      `/api/card-rooms/${code}/action`,
      { action, playerId: uid }
    );
    this.callbacks?.onState(data.state);
    return data.state;
  }

  async playAgain(
    code: string,
    uid: string,
    mode: 'lobby' | 'redeal'
  ): Promise<CardRoomClientState> {
    const data = await postJson<{ state: CardRoomClientState }>(
      `/api/card-rooms/${code}/play-again`,
      { mode, playerId: uid }
    );
    this.callbacks?.onState(data.state);
    return data.state;
  }

  async updateMuteState(uid: string, isMuted: boolean): Promise<void> {
    if (!this.activeCode) return;
    await postJson(`/api/card-rooms/${this.activeCode}/mute`, {
      isMuted,
      playerId: uid,
    }).catch(() => {});
  }

  async sendSignal(signal: Omit<SignalPayload, 'id' | 'timestamp'>): Promise<void> {
    if (!this.activeCode || !this.myUid) return;
    await postJson(`/api/card-rooms/${this.activeCode}/signal`, {
      playerId: this.myUid,
      signal: {
        ...signal,
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        timestamp: Date.now(),
      },
    }).catch(() => {});
  }

  async leaveRoom(code: string, uid: string): Promise<void> {
    saveActiveCardRoomCode(uid, null);
    this.closeStream();
    try {
      await postJson(`/api/card-rooms/${code}/leave`, { playerId: uid });
    } catch {
      // Ignore network failure on leave
    }
    this.activeCode = null;
    this.myUid = null;
    this.callbacks = null;
  }

  cleanup() {
    this.closeStream();
    this.activeCode = null;
    this.myUid = null;
    this.callbacks = null;
  }
}

export const cardRoomService = new CardRoomService();
