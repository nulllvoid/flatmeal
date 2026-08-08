#!/usr/bin/env python3
"""Generates recipes.csv, ingredients.csv, ingredient-glossary.csv from the data below.
Run: python3 generate_dataset.py  (validates, then writes CSVs next to itself)

Rules encoded here:
- qty is PER PERSON in buyable units; app multiplies by headcount and rounds.
- Salt is never listed (assumed present). Oil/ghee/spices are category 'staple'.
- Allergens are DERIVED from ingredients (dairy/gluten/peanut/soy) — never hand-tagged.
- Every ingredient name must exist in GLOSSARY (en -> hi, kn). Validation fails otherwise.
"""
import csv, sys, os

# ---------------- glossary: name_en -> (hi, kn) ----------------
GLOSSARY = {
 "Onion (medium)": ("प्याज़", "ಈರುಳ್ಳಿ"),
 "Tomato (medium)": ("टमाटर", "ಟೊಮೇಟೊ"),
 "Potato (medium)": ("आलू", "ಆಲೂಗಡ್ಡೆ"),
 "Spinach (palak)": ("पालक", "ಪಾಲಕ್ ಸೊಪ್ಪು"),
 "Paneer": ("पनीर", "ಪನೀರ್"),
 "Green peas": ("हरी मटर", "ಹಸಿರು ಬಟಾಣಿ"),
 "Cauliflower": ("फूलगोभी", "ಹೂಕೋಸು"),
 "Okra (bhindi)": ("भिंडी", "ಬೆಂಡೆಕಾಯಿ"),
 "Brinjal (large)": ("बड़ा बैंगन", "ದೊಡ್ಡ ಬದನೆಕಾಯಿ"),
 "Bottle gourd (lauki)": ("लौकी", "ಸೋರೆಕಾಯಿ"),
 "French beans": ("बीन्स", "ಹುರುಳಿಕಾಯಿ"),
 "Cabbage": ("पत्ता गोभी", "ಎಲೆಕೋಸು"),
 "Carrot": ("गाजर", "ಕ್ಯಾರೆಟ್"),
 "Capsicum": ("शिमला मिर्च", "ದೊಣ್ಣೆ ಮೆಣಸಿನಕಾಯಿ"),
 "Green chilli": ("हरी मिर्च", "ಹಸಿ ಮೆಣಸಿನಕಾಯಿ"),
 "Ginger": ("अदरक", "ಶುಂಠಿ"),
 "Garlic cloves": ("लहसुन", "ಬೆಳ್ಳುಳ್ಳಿ"),
 "Ginger-garlic paste": ("अदरक-लहसुन पेस्ट", "ಶುಂಠಿ-ಬೆಳ್ಳುಳ್ಳಿ ಪೇಸ್ಟ್"),
 "Coriander leaves": ("हरा धनिया", "ಕೊತ್ತಂಬರಿ ಸೊಪ್ಪು"),
 "Mint leaves": ("पुदीना", "ಪುದೀನ"),
 "Curry leaves": ("करी पत्ता", "ಕರಿಬೇವು"),
 "Spring onion": ("हरा प्याज़", "ಹಸಿರು ಈರುಳ್ಳಿ"),
 "Lemon": ("नींबू", "ನಿಂಬೆಹಣ್ಣು"),
 "Curd": ("दही", "ಮೊಸರು"),
 "Milk": ("दूध", "ಹಾಲು"),
 "Fresh cream": ("क्रीम", "ಕ್ರೀಮ್"),
 "Butter": ("मक्खन", "ಬೆಣ್ಣೆ"),
 "Ghee": ("घी", "ತುಪ್ಪ"),
 "Eggs": ("अंडे", "ಮೊಟ್ಟೆ"),
 "Chicken (curry cut)": ("चिकन (करी कट)", "ಕೋಳಿ ಮಾಂಸ (ಕರಿ ಕಟ್)"),
 "Mutton keema": ("मटन कीमा", "ಮಟನ್ ಕೀಮಾ"),
 "Fish (slices)": ("मछली (टुकड़े)", "ಮೀನು (ತುಂಡುಗಳು)"),
 "Toor dal": ("अरहर दाल", "ತೊಗರಿ ಬೇಳೆ"),
 "Moong dal": ("मूंग दाल", "ಹೆಸರು ಬೇಳೆ"),
 "Chana dal": ("चना दाल", "ಕಡಲೆ ಬೇಳೆ"),
 "Masoor dal": ("मसूर दाल", "ಮಸೂರ್ ಬೇಳೆ"),
 "Whole black urad dal": ("साबुत काली उड़द", "ಕಪ್ಪು ಉದ್ದಿನ ಬೇಳೆ"),
 "White urad dal": ("सफ़ेद उड़द दाल", "ಉದ್ದಿನ ಬೇಳೆ"),
 "Chickpeas (kabuli chana)": ("काबुली चना", "ಕಡಲೆಕಾಳು"),
 "Rajma": ("राजमा", "ರಾಜ್ಮಾ"),
 "Rice": ("चावल", "ಅಕ್ಕಿ"),
 "Basmati rice": ("बासमती चावल", "ಬಾಸ್ಮತಿ ಅಕ್ಕಿ"),
 "Noodles": ("नूडल्स", "ನೂಡಲ್ಸ್"),
 "Dosa batter": ("डोसा बैटर", "ದೋಸೆ ಹಿಟ್ಟು"),
 "Besan (gram flour)": ("बेसन", "ಕಡಲೆ ಹಿಟ್ಟು"),
 "Maida": ("मैदा", "ಮೈದಾ"),
 "Cornflour": ("कॉर्नफ्लोर", "ಕಾರ್ನ್ ಫ್ಲೋರ್"),
 "Cooking oil": ("तेल", "ಎಣ್ಣೆ"),
 "Mustard seeds": ("राई", "ಸಾಸಿವೆ"),
 "Cumin (jeera)": ("जीरा", "ಜೀರಿಗೆ"),
 "Turmeric": ("हल्दी", "ಅರಿಶಿನ"),
 "Red chilli powder": ("लाल मिर्च पाउडर", "ಕೆಂಪು ಮೆಣಸಿನ ಪುಡಿ"),
 "Coriander powder": ("धनिया पाउडर", "ಧನಿಯಾ ಪುಡಿ"),
 "Garam masala": ("गरम मसाला", "ಗರಂ ಮಸಾಲ"),
 "Sambar powder": ("सांभर पाउडर", "ಸಾಂಬಾರ್ ಪುಡಿ"),
 "Rasam powder": ("रसम पाउडर", "ರಸಂ ಪುಡಿ"),
 "Biryani masala": ("बिरयानी मसाला", "ಬಿರಿಯಾನಿ ಮಸಾಲ"),
 "Chicken masala": ("चिकन मसाला", "ಚಿಕನ್ ಮಸಾಲ"),
 "Black pepper (crushed)": ("कुटी काली मिर्च", "ಕರಿಮೆಣಸು ಪುಡಿ"),
 "Dried red chilli": ("सूखी लाल मिर्च", "ಒಣ ಕೆಂಪು ಮೆಣಸಿನಕಾಯಿ"),
 "Asafoetida (hing)": ("हींग", "ಇಂಗು"),
 "Tamarind": ("इमली", "ಹುಣಸೆಹಣ್ಣು"),
 "Jaggery": ("गुड़", "ಬೆಲ್ಲ"),
 "Grated coconut": ("कसा नारियल", "ತೆಂಗಿನ ತುರಿ"),
 "Coconut milk": ("नारियल का दूध", "ತೆಂಗಿನ ಹಾಲು"),
 "Peanuts": ("मूंगफली", "ಕಡಲೆಕಾಯಿ ಬೀಜ"),
 "Cashews": ("काजू", "ಗೋಡಂಬಿ"),
 "Kasuri methi": ("कसूरी मेथी", "ಕಸೂರಿ ಮೆಂತ್ಯ"),
 "Soy sauce": ("सोया सॉस", "ಸೋಯಾ ಸಾಸ್"),
 "Vinegar": ("सिरका", "ವಿನೆಗರ್"),
 "Tomato ketchup": ("टोमैटो सॉस", "ಟೊಮೇಟೊ ಸಾಸ್"),
 "Whole spices (bay leaf, cinnamon, cloves)": ("खड़े मसाले", "ಇಡೀ ಮಸಾಲೆ (ಚಕ್ಕೆ, ಲವಂಗ)"),
}

DAIRY = {"Paneer","Curd","Milk","Fresh cream","Butter","Ghee"}
GLUTEN = {"Maida","Noodles"}
PEANUT = {"Peanuts"}
SOY = {"Soy sauce"}
UNITS = {"piece","g","ml","bunch","packet","cup","tbsp","tsp"}
CATS = {"vegetable","dairy","staple","protein","other"}

# helpers: (name, qty_per_person, unit, category). staple iff category=='staple'
def V(n,q,u="piece"): return (n,q,u,"vegetable")
def D(n,q,u): return (n,q,u,"dairy")
def P(n,q,u): return (n,q,u,"protein")
def S(n,q,u): return (n,q,u,"staple")
def O(n,q,u): return (n,q,u,"other")

OIL=S("Cooking oil",2,"tsp"); GHEE=S("Ghee",1,"tsp"); GGP=S("Ginger-garlic paste",1,"tsp")
CUM=S("Cumin (jeera)",0.4,"tsp"); TUR=S("Turmeric",0.2,"tsp"); RCP=S("Red chilli powder",0.3,"tsp")
CORP=S("Coriander powder",0.4,"tsp"); GM=S("Garam masala",0.3,"tsp"); MUS=S("Mustard seeds",0.3,"tsp")
CURRY=S("Curry leaves",0.2,"bunch"); HING=S("Asafoetida (hing)",0.1,"tsp"); CORL=V("Coriander leaves",0.1,"bunch")

# recipe: slug,name,cuisine,base,diet,jain_ok,seasons,instructions,[ingredients]
R = [
("palak-paneer","Palak Paneer","north_indian","paneer","veg",False,"rabi",
 "Blanch spinach 2 minutes, grind to smooth puree. Heat oil, fry cumin, then onion till golden. Add ginger-garlic paste, tomato, salt, turmeric; cook till oil separates. Add puree, simmer 5 minutes. Add paneer cubes and garam masala, cook 3 minutes. Do not overcook paneer.",
 [V("Spinach (palak)",0.7,"bunch"),D("Paneer",70,"g"),V("Onion (medium)",0.7),V("Tomato (medium)",0.7),GGP,CUM,TUR,GM,OIL]),
("dal-tadka","Dal Tadka","north_indian","dal","veg",False,"all",
 "Pressure cook toor dal with turmeric and salt, 3 whistles; mash lightly. Tadka: heat ghee, add cumin, dried red chilli, chopped garlic and tomato, cook 2 minutes, pour over dal. Simmer 3 minutes, adjust consistency, finish with coriander leaves.",
 [P("Toor dal",60,"g"),V("Tomato (medium)",0.5),V("Garlic cloves",2),GHEE,CUM,S("Dried red chilli",0.7,"piece"),TUR,CORL]),
("matar-paneer","Matar Paneer","north_indian","paneer","veg",False,"rabi",
 "Grind onion and tomato separately. Heat oil, cook onion paste with ginger-garlic paste till golden, add tomato paste, salt, turmeric, red chilli and coriander powder; cook till oil separates. Add peas and water, simmer 5 minutes. Add paneer and garam masala, cook 3 minutes. Medium gravy consistency.",
 [D("Paneer",60,"g"),V("Green peas",50,"g"),V("Onion (medium)",0.7),V("Tomato (medium)",1),GGP,TUR,RCP,CORP,GM,OIL]),
("paneer-bhurji","Paneer Bhurji","north_indian","paneer","veg",False,"all",
 "Heat oil, fry chopped onion and green chilli till soft. Add chopped capsicum, cook 2 minutes. Add chopped tomato, salt, turmeric; cook till soft. Crumble in paneer, mix on medium heat 2–3 minutes. Finish with coriander leaves. Serve with roti.",
 [D("Paneer",75,"g"),V("Onion (medium)",0.7),V("Tomato (medium)",0.7),V("Capsicum",0.3),V("Green chilli",0.5),TUR,OIL,CORL]),
("kadai-paneer","Kadai Paneer","north_indian","paneer","veg",False,"all",
 "Heat oil, fry sliced onion till golden, add ginger-garlic paste, then chopped tomato, salt, coriander powder and red chilli powder; cook till thick. Add capsicum cubes, cook 3 minutes keeping crunch. Add paneer cubes and kasuri methi, toss 2 minutes. Semi-dry finish.",
 [D("Paneer",70,"g"),V("Capsicum",0.5),V("Onion (medium)",1),V("Tomato (medium)",1),GGP,CORP,RCP,S("Kasuri methi",0.3,"tsp"),OIL]),
("paneer-butter-masala","Paneer Butter Masala","north_indian","paneer","veg",False,"all",
 "Boil tomatoes, onion and cashews 10 minutes, cool and blend smooth, strain. Heat butter, add ginger-garlic paste, then the puree, salt, red chilli powder; simmer 8 minutes. Add paneer, kasuri methi, garam masala and cream, simmer 3 minutes. Mildly sweet-rich gravy, not too spicy.",
 [D("Paneer",70,"g"),V("Tomato (medium)",1.5),V("Onion (medium)",0.5),D("Butter",10,"g"),D("Fresh cream",15,"ml"),O("Cashews",8,"g"),GGP,RCP,S("Kasuri methi",0.3,"tsp"),GM]),
("chole","Chole (Chickpea Curry)","north_indian","chana","veg",False,"all",
 "Soak chickpeas overnight, pressure cook with salt till soft, 5–6 whistles. Heat oil, fry chopped onion till deep golden, add ginger-garlic paste, tomato, salt, turmeric, coriander and red chilli powder; cook till oil separates. Add chickpeas with cooking water, mash a few, simmer 10 minutes. Finish with garam masala.",
 [P("Chickpeas (kabuli chana)",60,"g"),V("Onion (medium)",1),V("Tomato (medium)",1),GGP,TUR,CORP,RCP,GM,OIL,CORL]),
("rajma","Rajma","north_indian","rajma","veg",False,"all",
 "Soak rajma overnight, pressure cook with salt till completely soft, 6–7 whistles. Heat oil, cook chopped onion till golden, add ginger-garlic paste, pureed tomato, salt, turmeric, red chilli and coriander powder; cook till thick. Add rajma with its water, mash a few, simmer 12 minutes till creamy. Finish with garam masala.",
 [P("Rajma",60,"g"),V("Onion (medium)",1),V("Tomato (medium)",1),GGP,TUR,RCP,CORP,GM,OIL]),
("dal-fry","Dal Fry","north_indian","dal","veg",False,"all",
 "Pressure cook toor dal, chana dal, moong dal and masoor dal together with turmeric and salt, 3 whistles; mash lightly. Heat ghee, add cumin, whole spices and dried red chilli, then chopped onion and green chilli; fry till onion softens. Add ginger-garlic paste and tomato, cook till soft. Add the cooked dal with a little water to loosen, simmer 5 minutes. Finish with garam masala and coriander leaves. A mixed-lentil dal, distinct from single-dal Dal Tadka.",
 [P("Toor dal",15,"g"),P("Chana dal",15,"g"),P("Moong dal",15,"g"),P("Masoor dal",15,"g"),V("Onion (medium)",0.5),V("Tomato (medium)",0.5),V("Green chilli",0.5),GGP,GHEE,CUM,TUR,GM,S("Whole spices (bay leaf, cinnamon, cloves)",1,"piece"),S("Dried red chilli",0.5,"piece"),CORL]),
("dal-makhani","Dal Makhani","north_indian","dal","veg",False,"all",
 "Soak black urad and rajma overnight, pressure cook with salt till very soft. Heat butter, add ginger-garlic paste and tomato puree, cook till thick. Add the dal, mash partially, simmer on low 25–30 minutes stirring often. Finish with cream and a little butter. Slow-simmered, creamy, mildly spiced.",
 [P("Whole black urad dal",50,"g"),P("Rajma",15,"g"),V("Tomato (medium)",1),D("Butter",10,"g"),D("Fresh cream",15,"ml"),GGP,RCP]),
("kadhi-pakoda","Kadhi Pakoda","north_indian","kadhi","veg",False,"all",
 "Whisk curd with besan, turmeric, salt and water until lump-free; simmer on low 20 minutes, stirring so it doesn't split. Pakoda: mix besan, chopped onion, salt and water to thick batter, fry small fritters. Temper mustard, cumin and dried chilli in oil, pour over kadhi, add pakodas, simmer 5 minutes.",
 [D("Curd",100,"g"),O("Besan (gram flour)",35,"g"),V("Onion (medium)",0.4),TUR,MUS,CUM,S("Dried red chilli",0.5,"piece"),OIL]),
("aloo-gobi","Aloo Gobi","north_indian","sabzi","veg",False,"rabi",
 "Heat oil, add cumin, then potato cubes; fry 4 minutes. Add cauliflower florets, salt, turmeric, red chilli and coriander powder. Cover and cook on low, stirring occasionally, till both are tender but not mushy, about 12 minutes. Dry sabzi, finish with garam masala and coriander leaves.",
 [V("Potato (medium)",1),V("Cauliflower",150,"g"),CUM,TUR,RCP,CORP,GM,OIL,CORL]),
("bhindi-fry","Bhindi Fry","north_indian","sabzi","veg",False,"kharif",
 "Wash bhindi and dry completely before cutting, else it turns sticky. Heat oil, fry sliced onion 2 minutes, add bhindi pieces, salt, turmeric and red chilli powder. Cook uncovered on medium, stirring gently, 10–12 minutes till no longer slimy. Finish with coriander powder. Dry sabzi for roti.",
 [V("Okra (bhindi)",150,"g"),V("Onion (medium)",0.5),TUR,RCP,CORP,S("Cooking oil",2.5,"tsp")]),
("baingan-bharta","Baingan Bharta","north_indian","sabzi","veg",False,"kharif,rabi",
 "Roast the whole brinjal directly on the flame till skin chars and flesh is soft; cool, peel, mash. Heat oil, fry chopped garlic, green chilli and onion till golden, add tomato and salt, cook soft. Add mashed brinjal, cook 5 minutes. Finish with coriander leaves.",
 [V("Brinjal (large)",0.5),V("Onion (medium)",0.7),V("Tomato (medium)",0.7),V("Garlic cloves",2),V("Green chilli",0.5),OIL,CORL]),
("jeera-aloo","Jeera Aloo","north_indian","aloo","veg",False,"all",
 "Boil potatoes till just done, peel and cube. Heat oil, crackle cumin generously, add potatoes, salt, turmeric and red chilli powder. Toss on medium heat 5 minutes till lightly crisp at edges. Squeeze a little lemon, finish with coriander leaves. Dry sabzi.",
 [V("Potato (medium)",1.5),S("Cumin (jeera)",0.7,"tsp"),TUR,RCP,V("Lemon",0.2),OIL,CORL]),
("mix-veg-sabzi","Mix Veg Sabzi","north_indian","sabzi","veg",False,"all",
 "Heat oil, add cumin, then chopped onion; fry till soft. Add ginger-garlic paste and tomato, cook 3 minutes. Add carrot, beans, potato, peas and capsicum with salt, turmeric, red chilli and coriander powder. Cover and cook on low till tender, about 12 minutes. Finish with garam masala.",
 [V("Carrot",0.3),V("French beans",40,"g"),V("Potato (medium)",0.5),V("Green peas",30,"g"),V("Capsicum",0.3),V("Onion (medium)",0.5),V("Tomato (medium)",0.5),GGP,CUM,TUR,RCP,CORP,GM,OIL]),
("aloo-matar","Aloo Matar","north_indian","aloo","veg",False,"rabi",
 "Heat oil, add cumin, fry chopped onion till golden, add ginger-garlic paste and pureed tomato with salt, turmeric, red chilli and coriander powder; cook till oil separates. Add potato cubes and peas with water, cover and simmer till potatoes are done. Light gravy, finish with garam masala.",
 [V("Potato (medium)",1),V("Green peas",50,"g"),V("Onion (medium)",0.7),V("Tomato (medium)",0.7),GGP,CUM,TUR,RCP,CORP,GM,OIL]),
("lauki-chana-dal","Lauki Chana Dal","north_indian","dal","veg",False,"kharif",
 "Soak chana dal 30 minutes. Pressure cook dal and cubed lauki with turmeric and salt, 3 whistles. Temper cumin, garlic and tomato in ghee, add to dal, simmer 5 minutes. Light, homely consistency; finish with coriander leaves.",
 [V("Bottle gourd (lauki)",150,"g"),P("Chana dal",40,"g"),V("Tomato (medium)",0.5),V("Garlic cloves",2),GHEE,CUM,TUR,CORL]),
("sambar","Sambar","south_indian","dal","veg",False,"all",
 "Pressure cook toor dal with turmeric, mash. Boil chopped beans, carrot, brinjal and small onion in tamarind water with salt and sambar powder till tender. Add dal, simmer 5 minutes. Temper mustard, curry leaves, hing and dried chilli in oil, pour over. Serve with rice.",
 [P("Toor dal",50,"g"),S("Sambar powder",1.5,"tsp"),O("Tamarind",10,"g"),V("French beans",30,"g"),V("Carrot",0.3),V("Brinjal (large)",0.15),V("Onion (medium)",0.5),V("Tomato (medium)",0.5),MUS,CURRY,HING,S("Dried red chilli",0.5,"piece"),TUR,OIL]),
("tomato-rasam","Tomato Rasam","south_indian","dal","veg",False,"all",
 "Cook and mash a little toor dal. Boil chopped tomatoes in tamarind water with rasam powder and salt, 8 minutes. Add mashed dal, simmer 5 minutes; do not boil hard after. Temper mustard, cumin, curry leaves and hing in ghee, pour over. Garnish with coriander. Serve with rice.",
 [P("Toor dal",25,"g"),V("Tomato (medium)",1),S("Rasam powder",1.2,"tsp"),O("Tamarind",8,"g"),MUS,CUM,CURRY,HING,GHEE,CORL]),
("curd-rice","Curd Rice","south_indian","curd","veg",False,"zaid",
 "Cook rice soft with slightly extra water, cool to warm, mash lightly. Mix in curd, a little milk and salt to a creamy consistency. Temper mustard, chana dal, green chilli, ginger and curry leaves in oil, fold in. Best served at room temperature.",
 [O("Rice",70,"g"),D("Curd",150,"g"),D("Milk",30,"ml"),V("Green chilli",0.5),V("Ginger",5,"g"),P("Chana dal",5,"g"),MUS,CURRY,OIL]),
("lemon-rice","Lemon Rice","south_indian","rice","veg",False,"all",
 "Cook rice with grains separate, spread to cool. Heat oil, crackle mustard, add peanuts, chana dal, green chilli, curry leaves and hing; fry till peanuts are golden. Add turmeric, switch off, squeeze in lemon juice and salt. Fold in rice gently without mashing.",
 [O("Rice",75,"g"),V("Lemon",0.5),O("Peanuts",10,"g"),P("Chana dal",5,"g"),V("Green chilli",0.7),MUS,CURRY,HING,TUR,OIL]),
("tomato-rice","Tomato Rice","south_indian","rice","veg",False,"all",
 "Heat oil, add whole spices and mustard, fry sliced onion till golden, add green chilli and chopped tomatoes with salt, turmeric and red chilli powder; cook till mushy. Add cooked rice and torn mint, toss on low till coated. Finish with coriander leaves.",
 [O("Rice",75,"g"),V("Tomato (medium)",1.5),V("Onion (medium)",0.5),V("Green chilli",0.5),V("Mint leaves",0.1,"bunch"),S("Whole spices (bay leaf, cinnamon, cloves)",1,"piece"),MUS,TUR,RCP,OIL,CORL]),
("bisi-bele-bath","Bisi Bele Bath","south_indian","rice","veg",False,"all",
 "Pressure cook rice and toor dal together till soft. Boil mixed vegetables in tamarind water with salt and sambar powder till tender. Combine with rice-dal, add jaggery, simmer to a loose porridge consistency. Temper mustard, curry leaves, peanuts and dried chilli in ghee, mix in. Serve hot.",
 [O("Rice",60,"g"),P("Toor dal",40,"g"),S("Sambar powder",1.5,"tsp"),O("Tamarind",8,"g"),O("Jaggery",5,"g"),V("Carrot",0.3),V("French beans",30,"g"),V("Green peas",20,"g"),O("Peanuts",10,"g"),MUS,CURRY,S("Dried red chilli",0.5,"piece"),GHEE]),
("veg-kurma","Vegetable Kurma","south_indian","sabzi","veg",False,"all",
 "Grind coconut, cashews, green chilli and a little cooked onion to a smooth paste. Heat oil, add whole spices, fry remaining onion, add ginger-garlic paste and tomato; cook soft. Add carrot, beans, potato, peas with salt and turmeric, cook till tender. Add the paste and water, simmer 8 minutes. Serve with chapati or dosa.",
 [V("Carrot",0.3),V("French beans",30,"g"),V("Potato (medium)",0.5),V("Green peas",20,"g"),O("Grated coconut",20,"g"),O("Cashews",5,"g"),V("Onion (medium)",0.7),V("Tomato (medium)",0.5),V("Green chilli",0.7),GGP,S("Whole spices (bay leaf, cinnamon, cloves)",1,"piece"),TUR,OIL]),
("beans-palya","Beans Palya","south_indian","sabzi","veg",False,"all",
 "Chop beans fine. Heat oil, crackle mustard, add urad dal, dried chilli and curry leaves; fry till dal is golden. Add beans, salt and turmeric, sprinkle water, cover and cook on low till tender, about 8 minutes. Switch off, mix in grated coconut. Dry Karnataka-style palya.",
 [V("French beans",120,"g"),O("Grated coconut",15,"g"),P("White urad dal",5,"g"),MUS,S("Dried red chilli",0.5,"piece"),CURRY,TUR,OIL]),
("cabbage-poriyal","Cabbage Poriyal","south_indian","sabzi","veg",False,"rabi",
 "Shred cabbage fine. Heat oil, crackle mustard, add urad dal, green chilli and curry leaves. Add cabbage, salt and turmeric, sprinkle little water, cover and cook on low 7–8 minutes till just tender, not mushy. Switch off, fold in grated coconut.",
 [V("Cabbage",150,"g"),O("Grated coconut",15,"g"),P("White urad dal",5,"g"),V("Green chilli",0.5),MUS,CURRY,TUR,OIL]),
("avial","Avial","south_indian","sabzi","veg",False,"all",
 "Cut carrot, beans, potato and lauki into batons; cook with salt and turmeric in little water till just tender. Grind coconut with cumin and green chilli coarsely, add to vegetables, simmer 3 minutes. Switch off, mix in whisked curd and curry leaves with a spoon of oil. Do not boil after adding curd.",
 [V("Carrot",0.4),V("French beans",40,"g"),V("Potato (medium)",0.5),V("Bottle gourd (lauki)",60,"g"),O("Grated coconut",25,"g"),D("Curd",50,"g"),V("Green chilli",0.7),CUM,TUR,CURRY,OIL]),
("puliogare","Puliogare (Tamarind Rice)","south_indian","rice","veg",False,"all",
 "Cook rice with separate grains, cool. Soak tamarind, extract thick pulp. Heat oil, crackle mustard, fry peanuts, chana dal, dried chillies, curry leaves and hing. Add tamarind pulp, turmeric, salt and jaggery; simmer till thick and oil surfaces. Mix the paste into rice gently.",
 [O("Rice",75,"g"),O("Tamarind",15,"g"),O("Peanuts",12,"g"),P("Chana dal",5,"g"),O("Jaggery",5,"g"),MUS,S("Dried red chilli",1,"piece"),CURRY,HING,TUR,S("Cooking oil",2.5,"tsp")]),
("dosa-with-chutney","Dosa with Coconut Chutney","south_indian","dosa","veg",False,"all",
 "Chutney: grind coconut, roasted chana dal, green chilli, ginger and salt with water; temper mustard and curry leaves in oil, pour over. Dosa: heat tawa till water sizzles, spread a ladle of batter thin in circles, drizzle oil at edges, cook till golden and crisp, fold. Make 2–3 dosas per person.",
 [O("Dosa batter",0.4,"packet"),O("Grated coconut",25,"g"),P("Chana dal",10,"g"),V("Green chilli",0.7),V("Ginger",4,"g"),MUS,CURRY,S("Cooking oil",2.5,"tsp")]),
("veg-pulao","Vegetable Pulao","north_indian","rice","veg",False,"all",
 "Soak basmati 20 minutes. Heat ghee, add whole spices and cumin, fry sliced onion till golden. Add carrot, beans and peas with salt, saute 3 minutes. Add rice and water 1:2, cook covered on low till done. Rest 5 minutes, fluff gently. Serve with raita if curd is available.",
 [O("Basmati rice",80,"g"),V("Onion (medium)",0.5),V("Carrot",0.3),V("French beans",30,"g"),V("Green peas",25,"g"),S("Whole spices (bay leaf, cinnamon, cloves)",1,"piece"),CUM,GHEE]),
("veg-biryani","Vegetable Biryani","pan_indian","rice","veg",False,"all",
 "Parboil soaked basmati 70% with salt and whole spices, drain. Fry sliced onion till brown. Cook carrot, beans, potato and peas with ginger-garlic paste, curd, biryani masala and salt till nearly done. Layer rice over vegetables with mint and fried onion, add ghee, cover tight and cook on low 12 minutes. Rest before opening.",
 [O("Basmati rice",80,"g"),V("Carrot",0.3),V("French beans",30,"g"),V("Potato (medium)",0.5),V("Green peas",20,"g"),V("Onion (medium)",1),D("Curd",30,"g"),S("Biryani masala",1,"tsp"),V("Mint leaves",0.2,"bunch"),GGP,S("Whole spices (bay leaf, cinnamon, cloves)",1,"piece"),GHEE]),
("moong-dal-khichdi","Moong Dal Khichdi","north_indian","khichdi","veg",True,"all",
 "Wash rice and moong dal together. Heat ghee, add cumin and hing, then rice, dal, turmeric and salt with 4 times water. Pressure cook 3 whistles to a soft, porridge-like consistency. Serve hot with a spoon of ghee on top. No onion or garlic in this dish.",
 [O("Rice",50,"g"),P("Moong dal",40,"g"),GHEE,CUM,HING,TUR]),
("veg-fried-rice","Veg Fried Rice","indo_chinese","rice","veg",False,"all",
 "Use rice cooked earlier and cooled, grains separate. Heat oil on high, fry chopped garlic, add carrot, beans and capsicum; toss 2 minutes keeping crunch. Add rice, soy sauce, vinegar, salt and pepper, toss on high heat 2 minutes. Finish with spring onion greens.",
 [O("Rice",75,"g"),V("Carrot",0.3),V("French beans",30,"g"),V("Capsicum",0.3),V("Garlic cloves",2),V("Spring onion",0.2,"bunch"),O("Soy sauce",1,"tsp"),O("Vinegar",0.5,"tsp"),S("Black pepper (crushed)",0.3,"tsp"),OIL]),
("hakka-noodles","Veg Hakka Noodles","indo_chinese","noodles","veg",False,"all",
 "Boil noodles just done, rinse in cold water, toss with little oil. Heat oil on high, fry chopped garlic, add shredded cabbage, carrot and capsicum; toss 2 minutes, keep crunchy. Add noodles, soy sauce, vinegar, salt and pepper; toss on high 2 minutes. Finish with spring onion.",
 [O("Noodles",80,"g"),V("Cabbage",40,"g"),V("Carrot",0.3),V("Capsicum",0.3),V("Garlic cloves",3),V("Spring onion",0.2,"bunch"),O("Soy sauce",1,"tsp"),O("Vinegar",0.5,"tsp"),S("Black pepper (crushed)",0.3,"tsp"),S("Cooking oil",2.5,"tsp")]),
("chilli-paneer","Chilli Paneer","indo_chinese","paneer","veg",False,"all",
 "Toss paneer cubes in cornflour with salt, shallow fry till edges crisp; remove. In same pan fry garlic, onion petals and capsicum on high 2 minutes. Add soy sauce, ketchup, a little vinegar and pepper; add paneer and a splash of water, toss till sauce coats. Semi-dry.",
 [D("Paneer",75,"g"),V("Capsicum",0.5),V("Onion (medium)",0.5),V("Garlic cloves",3),O("Cornflour",10,"g"),O("Soy sauce",1,"tsp"),O("Tomato ketchup",1,"tbsp"),O("Vinegar",0.5,"tsp"),S("Black pepper (crushed)",0.3,"tsp"),S("Cooking oil",3,"tsp")]),
("gobi-manchurian","Gobi Manchurian","indo_chinese","sabzi","veg",False,"rabi",
 "Dip cauliflower florets in a thick maida-cornflour batter with salt, deep fry till crisp; drain. Sauce: fry chopped garlic and onion on high, add soy sauce, ketchup, vinegar, pepper and a little water; thicken with cornflour slurry. Toss florets in sauce just before serving so they stay crisp. Garnish with spring onion.",
 [V("Cauliflower",150,"g"),O("Maida",15,"g"),O("Cornflour",15,"g"),V("Onion (medium)",0.5),V("Garlic cloves",3),V("Spring onion",0.2,"bunch"),O("Soy sauce",1,"tsp"),O("Tomato ketchup",1,"tbsp"),O("Vinegar",0.5,"tsp"),S("Black pepper (crushed)",0.3,"tsp"),S("Cooking oil",4,"tsp")]),
("egg-bhurji","Egg Bhurji","north_indian","egg","egg",False,"all",
 "Heat oil, fry chopped onion and green chilli till soft. Add chopped tomato, salt, turmeric and red chilli powder, cook 2 minutes. Break in the eggs and scramble on medium heat till just cooked and slightly moist. Finish with coriander leaves. Serve with roti or pav.",
 [P("Eggs",2,"piece"),V("Onion (medium)",0.7),V("Tomato (medium)",0.5),V("Green chilli",0.5),TUR,RCP,OIL,CORL]),
("egg-curry","Egg Curry","north_indian","egg","egg",False,"all",
 "Hard boil eggs, peel, slit lightly. Heat oil, fry chopped onion till golden, add ginger-garlic paste, pureed tomato, salt, turmeric, red chilli and coriander powder; cook till oil separates. Add water for a medium gravy, simmer 5 minutes, add eggs and garam masala, simmer 3 more minutes.",
 [P("Eggs",1.5,"piece"),V("Onion (medium)",1),V("Tomato (medium)",1),GGP,TUR,RCP,CORP,GM,OIL,CORL]),
("egg-fried-rice","Egg Fried Rice","indo_chinese","rice","egg",False,"all",
 "Scramble eggs with a pinch of salt, set aside. Heat oil on high, fry garlic, add carrot and beans, toss 2 minutes. Add cooled cooked rice, soy sauce, salt and pepper, toss on high. Mix in scrambled egg and spring onion, toss once more.",
 [O("Rice",75,"g"),P("Eggs",1,"piece"),V("Carrot",0.3),V("French beans",30,"g"),V("Garlic cloves",2),V("Spring onion",0.2,"bunch"),O("Soy sauce",1,"tsp"),S("Black pepper (crushed)",0.3,"tsp"),OIL]),
("masala-omelette","Masala Omelette","pan_indian","egg","egg",False,"all",
 "Beat eggs with salt, chopped onion, tomato, green chilli, coriander leaves and a pinch of turmeric. Heat oil on a tawa, pour the mix, cook on medium till set underneath, flip and cook the other side. Make one 2-egg omelette per person. Serve with bread or roti.",
 [P("Eggs",2,"piece"),V("Onion (medium)",0.5),V("Tomato (medium)",0.3),V("Green chilli",0.5),TUR,OIL,CORL]),
("chicken-curry","Home-style Chicken Curry","north_indian","chicken","nonveg",False,"all",
 "Heat oil, fry sliced onion till deep golden. Add ginger-garlic paste, then tomato, salt, turmeric, red chilli, coriander powder and chicken masala; cook till oil separates. Add chicken, sear 5 minutes, add hot water for gravy, cover and simmer till cooked through, about 20 minutes. Finish with garam masala and coriander.",
 [P("Chicken (curry cut)",200,"g"),V("Onion (medium)",1),V("Tomato (medium)",1),S("Ginger-garlic paste",1.5,"tsp"),TUR,RCP,CORP,S("Chicken masala",1,"tsp"),GM,S("Cooking oil",3,"tsp"),CORL]),
("butter-chicken","Butter Chicken","north_indian","chicken","nonveg",False,"all",
 "Marinate chicken in curd, ginger-garlic paste, salt and red chilli 30 minutes; pan-sear till browned. Blend boiled tomatoes and cashews smooth, strain. Cook puree in butter with salt and red chilli 8 minutes, add chicken, simmer till done. Finish with cream, kasuri methi and a little butter. Mildly sweet, not too spicy.",
 [P("Chicken (curry cut)",180,"g"),V("Tomato (medium)",2),D("Butter",15,"g"),D("Fresh cream",20,"ml"),D("Curd",30,"g"),O("Cashews",8,"g"),GGP,RCP,S("Kasuri methi",0.3,"tsp")]),
("chicken-biryani","Chicken Biryani","pan_indian","chicken","nonveg",False,"all",
 "Marinate chicken in curd, ginger-garlic paste, biryani masala and salt, 30 minutes. Fry sliced onion till brown, keep half aside. Cook chicken in the same pot till 80% done. Parboil soaked basmati with salt and whole spices, layer over chicken with mint and fried onion, add ghee, seal and cook on low 15 minutes.",
 [P("Chicken (curry cut)",200,"g"),O("Basmati rice",80,"g"),D("Curd",40,"g"),S("Biryani masala",1.5,"tsp"),V("Onion (medium)",1),V("Mint leaves",0.2,"bunch"),GGP,S("Whole spices (bay leaf, cinnamon, cloves)",1,"piece"),GHEE]),
("pepper-chicken","Pepper Chicken (South Style)","south_indian","chicken","nonveg",False,"all",
 "Heat oil, fry sliced onion with curry leaves till golden. Add ginger-garlic paste, then chicken with salt and turmeric; sear well. Cover and cook in its own juices till tender, adding splashes of water if needed. Finish dry with generous crushed black pepper and garam masala, tossing on high 3 minutes.",
 [P("Chicken (curry cut)",180,"g"),V("Onion (medium)",1),CURRY,GGP,TUR,S("Black pepper (crushed)",1,"tsp"),GM,S("Cooking oil",3,"tsp")]),
("chicken-fry","Chicken Fry","south_indian","chicken","nonveg",False,"all",
 "Marinate chicken with ginger-garlic paste, salt, turmeric, red chilli powder and lemon juice, 30 minutes. Heat oil, add curry leaves, then chicken; fry on medium, turning, till browned and cooked through, about 15 minutes. Dry, spicy finish. Serve with onion rings and lemon.",
 [P("Chicken (curry cut)",180,"g"),GGP,TUR,S("Red chilli powder",0.7,"tsp"),V("Lemon",0.3),CURRY,V("Onion (medium)",0.3),S("Cooking oil",3,"tsp")]),
("keema-matar","Keema Matar","north_indian","mutton","nonveg",False,"rabi",
 "Heat oil, fry chopped onion till deep golden, add ginger-garlic paste, tomato, salt, turmeric, red chilli and coriander powder; cook till oil separates. Add keema, break lumps, sear 8 minutes. Add peas and a little water, cover and simmer till keema is cooked and nearly dry. Finish with garam masala and coriander.",
 [P("Mutton keema",150,"g"),V("Green peas",40,"g"),V("Onion (medium)",1),V("Tomato (medium)",1),GGP,TUR,RCP,CORP,GM,S("Cooking oil",3,"tsp"),CORL]),
("fish-fry","Fish Fry","south_indian","fish","nonveg",False,"all",
 "Pat fish slices dry. Marinate with red chilli powder, turmeric, salt, ginger-garlic paste and lemon juice, 20 minutes. Dust lightly with cornflour. Shallow fry in hot oil 3–4 minutes per side till crisp outside and cooked through. Do not move the fish too early or it breaks. Serve with lemon.",
 [P("Fish (slices)",200,"g"),S("Red chilli powder",0.7,"tsp"),TUR,GGP,V("Lemon",0.3),O("Cornflour",10,"g"),S("Cooking oil",3,"tsp")]),
("fish-curry","Fish Curry (Coconut)","south_indian","fish","nonveg",False,"all",
 "Heat oil, crackle mustard and curry leaves, fry sliced onion soft. Add ginger-garlic paste, tomato, salt, turmeric and red chilli powder; cook 3 minutes. Add tamarind water, simmer 5 minutes. Add fish pieces gently, cook 6–7 minutes without stirring hard. Finish with coconut milk, heat through without boiling.",
 [P("Fish (slices)",200,"g"),O("Coconut milk",60,"ml"),O("Tamarind",8,"g"),V("Onion (medium)",0.7),V("Tomato (medium)",0.7),GGP,MUS,CURRY,TUR,RCP,OIL]),
]

def derive_allergens(ings):
    a=set()
    for (n,_,_,_) in ings:
        if n in DAIRY: a.add("dairy")
        if n in GLUTEN: a.add("gluten")
        if n in PEANUT: a.add("peanut")
        if n in SOY: a.add("soy")
    return sorted(a)

def main():
    here=os.path.dirname(os.path.abspath(__file__))
    errs=[]; slugs=set()
    for (slug,name,cui,base,diet,jain,seasons,instr,ings) in R:
        if slug in slugs: errs.append(f"dup slug {slug}")
        slugs.add(slug)
        for (n,q,u,c) in ings:
            if n not in GLOSSARY: errs.append(f"{slug}: '{n}' missing from glossary")
            if u not in UNITS: errs.append(f"{slug}: bad unit {u} for {n}")
            if c not in CATS: errs.append(f"{slug}: bad category {c} for {n}")
            if not (q>0): errs.append(f"{slug}: qty<=0 for {n}")
        if len(ings)<4: errs.append(f"{slug}: too few ingredients")
        if len(instr.split())<25: errs.append(f"{slug}: instructions too short")
    if errs:
        print("VALIDATION FAILED:"); [print(" -",e) for e in errs]; sys.exit(1)

    with open(os.path.join(here,"recipes.csv"),"w",newline="",encoding="utf-8") as f:
        w=csv.writer(f)
        w.writerow(["slug","name","cuisine","base","diet_class","jain_ok","allergens","seasons","instructions_en","image_path"])
        for (slug,name,cui,base,diet,jain,seasons,instr,ings) in R:
            seas="kharif,rabi,zaid" if seasons=="all" else seasons
            w.writerow([slug,name,cui,base,diet,str(jain).lower(),",".join(derive_allergens(ings)),seas,instr,""])

    with open(os.path.join(here,"ingredients.csv"),"w",newline="",encoding="utf-8") as f:
        w=csv.writer(f)
        w.writerow(["recipe_slug","name_en","name_hi","name_kn","qty_per_person","unit","category","is_staple","sort_order"])
        for (slug,_,_,_,_,_,_,_,ings) in R:
            for i,(n,q,u,c) in enumerate(ings,1):
                hi,kn=GLOSSARY[n]
                w.writerow([slug,n,hi,kn,q,u,c,str(c=="staple").lower(),i])

    with open(os.path.join(here,"ingredient-glossary.csv"),"w",newline="",encoding="utf-8") as f:
        w=csv.writer(f)
        w.writerow(["name_en","name_hi","name_kn"])
        for n,(hi,kn) in sorted(GLOSSARY.items()): w.writerow([n,hi,kn])

    # stats
    from collections import Counter
    diets=Counter(r[4] for r in R); cuis=Counter(r[2] for r in R); bases=Counter(r[3] for r in R)
    n_ing=sum(len(r[8]) for r in R)
    print(f"OK: {len(R)} recipes, {n_ing} ingredient rows, {len(GLOSSARY)} glossary entries")
    print("diet:",dict(diets)); print("cuisine:",dict(cuis)); print("bases:",len(bases),"distinct")

if __name__=="__main__": main()
