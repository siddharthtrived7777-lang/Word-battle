import { CategoryId, WordPair } from '../types/game';

export interface CategoryMeta {
  id: CategoryId;
  en: string;
  hi: string;
}

export const CATEGORIES: CategoryMeta[] = [
  { id: 'food_drinks', en: 'Food & Drinks', hi: 'खाना और पीना' },
  { id: 'everyday_objects', en: 'Everyday Objects', hi: 'रोज़मर्रा की चीज़ें' },
  { id: 'places_nature', en: 'Places & Nature', hi: 'जगहें और प्रकृति' },
  { id: 'animals', en: 'Animals', hi: 'जानवर' },
  { id: 'technology', en: 'Technology', hi: 'टेक्नोलॉजी' },
  { id: 'clothing', en: 'Clothing', hi: 'कपड़े' },
  { id: 'household', en: 'Household', hi: 'घरेलू सामान' },
  { id: 'vehicles', en: 'Vehicles', hi: 'गाड़ियाँ और वाहन' },
  { id: 'sports_hobbies', en: 'Sports & Hobbies', hi: 'खेल और शौक' },
];

export const WORD_PAIRS: WordPair[] = [
  // Food & Drinks (15 pairs)
  { id: 'fd_01', category: 'food_drinks', en: ['Coffee', 'Tea'], hi: ['कॉफ़ी', 'चाय'] },
  { id: 'fd_02', category: 'food_drinks', en: ['Ice Cream', 'Yogurt'], hi: ['आइसक्रीम', 'दही'] },
  { id: 'fd_03', category: 'food_drinks', en: ['Burger', 'Sandwich'], hi: ['बर्गर', 'सैंडविच'] },
  { id: 'fd_04', category: 'food_drinks', en: ['Pancake', 'Waffle'], hi: ['पैनकेक', 'वॉफ़ल'] },
  { id: 'fd_05', category: 'food_drinks', en: ['Apple', 'Tomato'], hi: ['सेब', 'टमाटर'] },
  { id: 'fd_06', category: 'food_drinks', en: ['Pizza', 'Pasta'], hi: ['पिज़्ज़ा', 'पास्ता'] },
  { id: 'fd_07', category: 'food_drinks', en: ['Mango', 'Papaya'], hi: ['आम', 'पपीता'] },
  { id: 'fd_08', category: 'food_drinks', en: ['Rice', 'Noodles'], hi: ['चावल', 'नूडल्स'] },
  { id: 'fd_09', category: 'food_drinks', en: ['Chocolate', 'Caramel'], hi: ['चॉकलेट', 'कैरामेल'] },
  { id: 'fd_10', category: 'food_drinks', en: ['Lemonade', 'Soda'], hi: ['नींबू पानी', 'सोडा'] },
  { id: 'fd_11', category: 'food_drinks', en: ['Bread', 'Toast'], hi: ['ब्रेड', 'टोस्ट'] },
  { id: 'fd_12', category: 'food_drinks', en: ['Butter', 'Cheese'], hi: ['मक्खन', 'पनीर / चीज़'] },
  { id: 'fd_13', category: 'food_drinks', en: ['Soup', 'Stew'], hi: ['सूप', 'शोरबा'] },
  { id: 'fd_14', category: 'food_drinks', en: ['Cake', 'Muffin'], hi: ['केक', 'मफ़िन'] },
  { id: 'fd_15', category: 'food_drinks', en: ['Donut', 'Bagel'], hi: ['डोनट', 'बेगल'] },

  // Everyday Objects (15 pairs)
  { id: 'eo_01', category: 'everyday_objects', en: ['Watch', 'Clock'], hi: ['कलाई घड़ी', 'दीवार घड़ी'] },
  { id: 'eo_02', category: 'everyday_objects', en: ['Pen', 'Pencil'], hi: ['पेन', 'पेंसिल'] },
  { id: 'eo_03', category: 'everyday_objects', en: ['Shampoo', 'Soap'], hi: ['शैम्पू', 'साबुन'] },
  { id: 'eo_04', category: 'everyday_objects', en: ['Wallet', 'Purse'], hi: ['बटुआ', 'पर्स'] },
  { id: 'eo_05', category: 'everyday_objects', en: ['Glasses', 'Contacts'], hi: ['चश्मा', 'कॉन्टैक्ट लेंस'] },
  { id: 'eo_06', category: 'everyday_objects', en: ['Key', 'Lock'], hi: ['चाबी', 'ताला'] },
  { id: 'eo_07', category: 'everyday_objects', en: ['Umbrella', 'Raincoat'], hi: ['छाता', 'रेनकोट'] },
  { id: 'eo_08', category: 'everyday_objects', en: ['Mirror', 'Window'], hi: ['आईना', 'खिड़की'] },
  { id: 'eo_09', category: 'everyday_objects', en: ['Toothbrush', 'Comb'], hi: ['टूथब्रश', 'कंघी'] },
  { id: 'eo_10', category: 'everyday_objects', en: ['Notebook', 'Diary'], hi: ['नोटबुक', 'डायरी'] },
  { id: 'eo_11', category: 'everyday_objects', en: ['Candle', 'Flashlight'], hi: ['मोमबत्ती', 'टॉर्च'] },
  { id: 'eo_12', category: 'everyday_objects', en: ['Scissors', 'Knife'], hi: ['कैंची', 'चाकू'] },
  { id: 'eo_13', category: 'everyday_objects', en: ['Backpack', 'Suitcase'], hi: ['बैकपैक', 'सूटकेस'] },
  { id: 'eo_14', category: 'everyday_objects', en: ['Charger', 'Battery'], hi: ['चार्जर', 'बैटरी'] },
  { id: 'eo_15', category: 'everyday_objects', en: ['Mug', 'Glass'], hi: ['मग', 'गिलास'] },

  // Places & Nature (15 pairs)
  { id: 'pn_01', category: 'places_nature', en: ['Ocean', 'River'], hi: ['समुद्र', 'नदी'] },
  { id: 'pn_02', category: 'places_nature', en: ['Hospital', 'Clinic'], hi: ['अस्पताल', 'क्लिनिक'] },
  { id: 'pn_03', category: 'places_nature', en: ['Forest', 'Jungle'], hi: ['वन', 'जंगल'] },
  { id: 'pn_04', category: 'places_nature', en: ['Mountain', 'Hill'], hi: ['पर्वत', 'पहाड़ी'] },
  { id: 'pn_05', category: 'places_nature', en: ['Hotel', 'Apartment'], hi: ['होटल', 'अपार्टमेंट'] },
  { id: 'pn_06', category: 'places_nature', en: ['Beach', 'Desert'], hi: ['समुद्र तट', 'रेगिस्तान'] },
  { id: 'pn_07', category: 'places_nature', en: ['Library', 'Bookstore'], hi: ['पुस्तकालय', 'किताबों की दुकान'] },
  { id: 'pn_08', category: 'places_nature', en: ['School', 'College'], hi: ['स्कूल', 'कॉलेज'] },
  { id: 'pn_09', category: 'places_nature', en: ['Museum', 'Gallery'], hi: ['संग्रहालय', 'आर्ट गैलरी'] },
  { id: 'pn_10', category: 'places_nature', en: ['Park', 'Garden'], hi: ['पार्क', 'बगीचा'] },
  { id: 'pn_11', category: 'places_nature', en: ['Island', 'Peninsula'], hi: ['द्वीप', 'प्रायद्वीप'] },
  { id: 'pn_12', category: 'places_nature', en: ['Waterfall', 'Fountain'], hi: ['झरना', 'फव्वारा'] },
  { id: 'pn_13', category: 'places_nature', en: ['Airport', 'Train Station'], hi: ['हवाई अड्डा', 'रेलवे स्टेशन'] },
  { id: 'pn_14', category: 'places_nature', en: ['Cinema', 'Theater'], hi: ['सिनेमाघर', 'थिएटर'] },
  { id: 'pn_15', category: 'places_nature', en: ['Cave', 'Tunnel'], hi: ['गुफ़ा', 'सुरंग'] },

  // Animals (15 pairs)
  { id: 'an_01', category: 'animals', en: ['Dog', 'Wolf'], hi: ['कुत्ता', 'भेड़िया'] },
  { id: 'an_02', category: 'animals', en: ['Bee', 'Mosquito'], hi: ['मधुमक्खी', 'मच्छर'] },
  { id: 'an_03', category: 'animals', en: ['Shark', 'Dolphin'], hi: ['शार्क', 'डॉल्फ़िन'] },
  { id: 'an_04', category: 'animals', en: ['Rabbit', 'Kangaroo'], hi: ['खरगोश', 'कंगारू'] },
  { id: 'an_05', category: 'animals', en: ['Lion', 'Tiger'], hi: ['शेर', 'बाघ'] },
  { id: 'an_06', category: 'animals', en: ['Eagle', 'Hawk'], hi: ['चील', 'बाज़'] },
  { id: 'an_07', category: 'animals', en: ['Frog', 'Toad'], hi: ['मेंढक', 'टोड'] },
  { id: 'an_08', category: 'animals', en: ['Crocodile', 'Alligator'], hi: ['मगरमच्छ', 'घड़ियाल'] },
  { id: 'an_09', category: 'animals', en: ['Horse', 'Zebra'], hi: ['घोड़ा', 'ज़ेबरा'] },
  { id: 'an_10', category: 'animals', en: ['Penguin', 'Seal'], hi: ['पेंगुइन', 'सील'] },
  { id: 'an_11', category: 'animals', en: ['Butterfly', 'Moth'], hi: ['तितली', 'पतंगा'] },
  { id: 'an_12', category: 'animals', en: ['Owl', 'Bat'], hi: ['उल्लू', 'चमगादड़'] },
  { id: 'an_13', category: 'animals', en: ['Camel', 'Llama'], hi: ['ऊँट', 'लामा'] },
  { id: 'an_14', category: 'animals', en: ['Monkey', 'Gorilla'], hi: ['बंदर', 'गोरिल्ला'] },
  { id: 'an_15', category: 'animals', en: ['Turtle', 'Tortoise'], hi: ['समुद्री कछुआ', 'कछुआ'] },

  // Technology (15 pairs)
  { id: 'tc_01', category: 'technology', en: ['Phone', 'Tablet'], hi: ['फ़ोन', 'टैबलेट'] },
  { id: 'tc_02', category: 'technology', en: ['Headphones', 'Earbuds'], hi: ['हेडफ़ोन', 'ईयरबड्स'] },
  { id: 'tc_03', category: 'technology', en: ['Laptop', 'Desktop'], hi: ['लैपटॉप', 'डेस्कटॉप'] },
  { id: 'tc_04', category: 'technology', en: ['Television', 'Projector'], hi: ['टेलीविज़न', 'प्रोजेक्टर'] },
  { id: 'tc_05', category: 'technology', en: ['Keyboard', 'Mouse'], hi: ['कीबोर्ड', 'माउस'] },
  { id: 'tc_06', category: 'technology', en: ['Camera', 'Webcam'], hi: ['कैमरा', 'वेबकैम'] },
  { id: 'tc_07', category: 'technology', en: ['Smartwatch', 'Fitness Band'], hi: ['स्मार्टवॉच', 'फ़िटनेस बैंड'] },
  { id: 'tc_08', category: 'technology', en: ['Wi-Fi', 'Bluetooth'], hi: ['वाई-फ़ाई', 'ब्लूटूथ'] },
  { id: 'tc_09', category: 'technology', en: ['Printer', 'Scanner'], hi: ['प्रिंटर', 'स्कैनर'] },
  { id: 'tc_10', category: 'technology', en: ['Speaker', 'Microphone'], hi: ['स्पीकर', 'माइक्रोफ़ोन'] },
  { id: 'tc_11', category: 'technology', en: ['Drone', 'Satellite'], hi: ['ड्रोन', 'सैटेलाइट'] },
  { id: 'tc_12', category: 'technology', en: ['Hard Drive', 'USB Flash'], hi: ['हार्ड ड्राइव', 'पेन ड्राइव'] },
  { id: 'tc_13', category: 'technology', en: ['Email', 'Text Message'], hi: ['ईमेल', 'टेक्स्ट मैसेज'] },
  { id: 'tc_14', category: 'technology', en: ['Website', 'Mobile App'], hi: ['वेबसाइट', 'मोबाइल ऐप'] },
  { id: 'tc_15', category: 'technology', en: ['Router', 'Modem'], hi: ['राउटर', 'मॉडेम'] },

  // Clothing (15 pairs)
  { id: 'cl_01', category: 'clothing', en: ['Sweater', 'Jacket'], hi: ['स्वेटर', 'जैकेट'] },
  { id: 'cl_02', category: 'clothing', en: ['Sneakers', 'Boots'], hi: ['स्नीकर्स', 'बूट्स'] },
  { id: 'cl_03', category: 'clothing', en: ['Scarf', 'Tie'], hi: ['स्काफ़', 'टाई'] },
  { id: 'cl_04', category: 'clothing', en: ['Hat', 'Helmet'], hi: ['टोपी', 'हेलमेट'] },
  { id: 'cl_05', category: 'clothing', en: ['Jeans', 'Trousers'], hi: ['जींस', 'पैंट'] },
  { id: 'cl_06', category: 'clothing', en: ['Shirt', 'T-Shirt'], hi: ['शर्ट', 'टी-शर्ट'] },
  { id: 'cl_07', category: 'clothing', en: ['Socks', 'Stockings'], hi: ['मोज़े', 'स्टॉकिंग्स'] },
  { id: 'cl_08', category: 'clothing', en: ['Gloves', 'Mittens'], hi: ['दस्ताने', 'मिटन्स'] },
  { id: 'cl_09', category: 'clothing', en: ['Sunglasses', 'Goggles'], hi: ['धूप का चश्मा', 'गॉगल्स'] },
  { id: 'cl_10', category: 'clothing', en: ['Belt', 'Suspenders'], hi: ['बेल्ट', 'सस्पेंडर्स'] },
  { id: 'cl_11', category: 'clothing', en: ['Coat', 'Blazer'], hi: ['कोट', 'ब्लेज़र'] },
  { id: 'cl_12', category: 'clothing', en: ['Slippers', 'Sandals'], hi: ['चप्पल', 'सैंडल'] },
  { id: 'cl_13', category: 'clothing', en: ['Hoodie', 'Cardigan'], hi: ['हुडी', 'कार्डिगन'] },
  { id: 'cl_14', category: 'clothing', en: ['Shorts', 'Skirt'], hi: ['शॉर्ट्स', 'स्कर्ट'] },
  { id: 'cl_15', category: 'clothing', en: ['Suit', 'Tuxedo'], hi: ['सूट', 'टक्सीडो'] },

  // Household (15 pairs)
  { id: 'hh_01', category: 'household', en: ['Broom', 'Vacuum'], hi: ['झाड़ू', 'वैक्यूम क्लीनर'] },
  { id: 'hh_02', category: 'household', en: ['Blanket', 'Quilt'], hi: ['कंबल', 'रज़ाई'] },
  { id: 'hh_03', category: 'household', en: ['Sofa', 'Chair'], hi: ['सोफ़ा', 'कुर्सी'] },
  { id: 'hh_04', category: 'household', en: ['Oven', 'Microwave'], hi: ['ओवन', 'माइक्रोवेव'] },
  { id: 'hh_05', category: 'household', en: ['Pillow', 'Cushion'], hi: ['तकिया', 'कुशन'] },
  { id: 'hh_06', category: 'household', en: ['Fridge', 'Freezer'], hi: ['फ़्रिज', 'फ़्रीज़र'] },
  { id: 'hh_07', category: 'household', en: ['Curtain', 'Blinds'], hi: ['पर्दा', 'ब्लाइंड्स'] },
  { id: 'hh_08', category: 'household', en: ['Spoon', 'Fork'], hi: ['चम्मच', 'काँटा'] },
  { id: 'hh_09', category: 'household', en: ['Plate', 'Bowl'], hi: ['प्लेट', 'कटोरी'] },
  { id: 'hh_10', category: 'household', en: ['Towel', 'Napkin'], hi: ['तौलिया', 'नैपकिन'] },
  { id: 'hh_11', category: 'household', en: ['Sink', 'Bathtub'], hi: ['सिंक', 'बाथटब'] },
  { id: 'hh_12', category: 'household', en: ['Lamp', 'Chandelier'], hi: ['लैंप', 'झूमर'] },
  { id: 'hh_13', category: 'household', en: ['Carpet', 'Rug'], hi: ['कालीन', 'चटाई'] },
  { id: 'hh_14', category: 'household', en: ['Kettle', 'Toaster'], hi: ['केतली', 'टोस्टर'] },
  { id: 'hh_15', category: 'household', en: ['Washing Machine', 'Dryer'], hi: ['वॉशिंग मशीन', 'ड्रायर'] },

  // Vehicles (15 pairs)
  { id: 'vh_01', category: 'vehicles', en: ['Car', 'Truck'], hi: ['कार', 'ट्रक'] },
  { id: 'vh_02', category: 'vehicles', en: ['Train', 'Subway'], hi: ['ट्रेन', 'मेट्रो'] },
  { id: 'vh_03', category: 'vehicles', en: ['Helicopter', 'Airplane'], hi: ['हेलीकॉप्टर', 'हवाई जहाज़'] },
  { id: 'vh_04', category: 'vehicles', en: ['Bicycle', 'Motorcycle'], hi: ['साइकिल', 'मोटरसाइकिल'] },
  { id: 'vh_05', category: 'vehicles', en: ['Bus', 'Van'], hi: ['बस', 'वैन'] },
  { id: 'vh_06', category: 'vehicles', en: ['Boat', 'Ship'], hi: ['नाव', 'पानी का जहाज़'] },
  { id: 'vh_07', category: 'vehicles', en: ['Taxi', 'Auto Rickshaw'], hi: ['टैक्सी', 'ऑटो रिक्शा'] },
  { id: 'vh_08', category: 'vehicles', en: ['Scooter', 'Skateboard'], hi: ['स्कूटर', 'स्केटबोर्ड'] },
  { id: 'vh_09', category: 'vehicles', en: ['Ambulance', 'Fire Truck'], hi: ['एम्बुलेंस', 'दमकल गाड़ी'] },
  { id: 'vh_10', category: 'vehicles', en: ['Tractor', 'Bulldozer'], hi: ['ट्रैक्टर', 'बुलडोज़र'] },
  { id: 'vh_11', category: 'vehicles', en: ['Rocket', 'Spaceship'], hi: ['रॉकेट', 'अंतरिक्ष यान'] },
  { id: 'vh_12', category: 'vehicles', en: ['Kayak', 'Canoe'], hi: ['कयाक', 'डोंगी'] },
  { id: 'vh_13', category: 'vehicles', en: ['Tram', 'Cable Car'], hi: ['ट्राम', 'केबल कार'] },
  { id: 'vh_14', category: 'vehicles', en: ['Yacht', 'Cruise'], hi: ['यॉट', 'क्रूज़ शिप'] },
  { id: 'vh_15', category: 'vehicles', en: ['Ferry', 'Submarine'], hi: ['फ़ेरी', 'पनडुब्बी'] },

  // Sports & Hobbies (15 pairs)
  { id: 'sh_01', category: 'sports_hobbies', en: ['Tennis', 'Badminton'], hi: ['टेनिस', 'बैडमिंटन'] },
  { id: 'sh_02', category: 'sports_hobbies', en: ['Guitar', 'Violin'], hi: ['गिटार', 'वायलिन'] },
  { id: 'sh_03', category: 'sports_hobbies', en: ['Soccer', 'Basketball'], hi: ['फ़ुटबॉल', 'बास्केटबॉल'] },
  { id: 'sh_04', category: 'sports_hobbies', en: ['Painting', 'Drawing'], hi: ['पेंटिंग', 'ड्राइंग'] },
  { id: 'sh_05', category: 'sports_hobbies', en: ['Cricket', 'Baseball'], hi: ['क्रिकेट', 'बेसबॉल'] },
  { id: 'sh_06', category: 'sports_hobbies', en: ['Chess', 'Checkers'], hi: ['शतरंज', 'चेकर्स'] },
  { id: 'sh_07', category: 'sports_hobbies', en: ['Swimming', 'Diving'], hi: ['तैराकी', 'गोताखोरी'] },
  { id: 'sh_08', category: 'sports_hobbies', en: ['Yoga', 'Pilates'], hi: ['योगा', 'पिलेट्स'] },
  { id: 'sh_09', category: 'sports_hobbies', en: ['Photography', 'Videography'], hi: ['फ़ोटोग्राफ़ी', 'वीडियोग्राफ़ी'] },
  { id: 'sh_10', category: 'sports_hobbies', en: ['Cycling', 'Running'], hi: ['साइकलिंग', 'दौड़ना'] },
  { id: 'sh_11', category: 'sports_hobbies', en: ['Piano', 'Accordion'], hi: ['पियानो', 'हारमोनियम'] },
  { id: 'sh_12', category: 'sports_hobbies', en: ['Boxing', 'Wrestling'], hi: ['मुक्केबाज़ी', 'कुश्ती'] },
  { id: 'sh_13', category: 'sports_hobbies', en: ['Camping', 'Hiking'], hi: ['कैंपिंग', 'हाइकिंग'] },
  { id: 'sh_14', category: 'sports_hobbies', en: ['Cooking', 'Baking'], hi: ['खाना बनाना', 'बेकिंग'] },
  { id: 'sh_15', category: 'sports_hobbies', en: ['Golf', 'Bowling'], hi: ['गोल्फ़', 'बॉलिंग'] },
];

export function getCategoryLabel(category: CategoryId | 'random', lang: 'en' | 'hi'): string {
  if (category === 'random') {
    return lang === 'hi' ? 'रैंडम (सभी)' : 'Random (All)';
  }
  const found = CATEGORIES.find((c) => c.id === category);
  return found ? found[lang] : category;
}

export function getPairById(pairId: string): WordPair | undefined {
  return WORD_PAIRS.find((p) => p.id === pairId);
}
