/**
 * pokemon_gates.ts
 *
 * Static categorization sets for Pokémon gate items.
 * These mirror the categorization in the APWorld's data.py and are used by
 * GameContext.isPokemonGuessable() to enforce lock rules client-side.
 *
 * Keep in sync with worlds/pokepelago/data.py in ArchipelagoPokepelago.
 */

// Sub-legendaries — require 6 Gym Badges
// Legendary trios, regis, lake guardians, swords of justice, forces of nature, tapus, etc.
export const SUB_LEGENDARY_IDS = new Set<number>([
    144, 145, 146,              // Kanto bird trio
    243, 244, 245,              // Johto beast trio
    377, 378, 379, 380, 381,    // Hoenn regis + eon duo
    480, 481, 482, 485, 486, 488, 489,  // Sinnoh lake guardians + others
    638, 639, 640, 641, 642, 645,       // Unova swords of justice + forces of nature
    785, 786, 787, 788,         // Alola tapus
    891, 892,                   // Galar kubfu / urshifu
    894, 895, 896, 897,         // Galar regis + horses
    905,                        // Hisui enamorus
    1001, 1002, 1003, 1004,     // Paldea ruinous quartet
]);

// Box legendaries — require 7 Gym Badges
export const BOX_LEGENDARY_IDS = new Set<number>([
    150,                        // Mewtwo
    249, 250,                   // Lugia, Ho-Oh
    382, 383, 384,              // Kyogre, Groudon, Rayquaza
    483, 484, 487,              // Dialga, Palkia, Giratina
    643, 644, 646,              // Reshiram, Zekrom, Kyurem
    716, 717, 718,              // Xerneas, Yveltal, Zygarde
    791, 792, 800,              // Solgaleo, Lunala, Necrozma
    888, 889, 890, 898,         // Zacian, Zamazenta, Eternatus, Calyrex
    1007, 1008, 1024,           // Koraidon, Miraidon, Terapagos
]);

// Mythics — require 8 Gym Badges (event-only distribution Pokémon)
export const MYTHIC_IDS = new Set<number>([
    151,                        // Mew
    251,                        // Celebi
    385, 386,                   // Jirachi, Deoxys
    490, 491, 492, 493,         // Manaphy, Darkrai, Shaymin, Arceus
    494,                        // Victini
    647, 648, 649,              // Keldeo, Meloetta, Genesect
    719, 720, 721,              // Diancie, Hoopa, Volcanion
    801, 802,                   // Magearna, Marshadow
    807, 808, 809,              // Zeraora, Meltan, Melmetal
    893,                        // Zarude
    1025,                       // Pecharunt
]);

// Baby Pokémon — require Daycare item(s)
export const BABY_IDS = new Set<number>([
    172, 173, 174, 175,         // Pichu, Cleffa, Igglybuff, Togepi
    236, 238, 239, 240,         // Tyrogue, Smoochum, Elekid, Magby
    298, 360,                   // Azurill, Wynaut
    406, 433, 438, 439, 440, 446, 447, 458,  // Gen 4 babies (Budew–Mantyke)
]);

// Trade-evolved Pokémon — require Link Cable
export const TRADE_EVO_IDS = new Set<number>([
    65, 68, 76, 94,             // Gen 1: Alakazam, Machamp, Golem, Gengar
    186, 199, 208, 212, 230, 233, // Gen 2: Politoed, Slowking, Steelix, Scizor, Kingdra, Porygon2
    367, 368,                   // Gen 3: Huntail, Gorebyss
    464, 466, 467, 474, 477,    // Gen 4: Rhyperior, Electivire, Magmortar, Porygon-Z, Dusknoir
    526, 534, 589, 590,         // Gen 5: Gigalith, Conkeldurr, Escavalier, Accelgor
]);

// Fossil Pokémon — require Fossil Restorer
export const FOSSIL_IDS = new Set<number>([
    138, 139, 140, 141, 142,    // Gen 1: Omanyte, Omastar, Kabuto, Kabutops, Aerodactyl
    345, 346, 347, 348,         // Gen 3: Lileep, Cradily, Anorith, Armaldo
    408, 409, 410, 411,         // Gen 4: Cranidos, Rampardos, Shieldon, Bastiodon
    564, 565, 566, 567,         // Gen 5: Tirtouga, Carracosta, Archen, Archeops
    696, 697, 698, 699,         // Gen 6: Tyrunt, Tyrantrum, Amaura, Aurorus
    880, 881, 882, 883,         // Gen 8: Dracozolt, Arctozolt, Dracovish, Arctovish
]);

// Ultra Beasts — require Ultra Wormhole
// Necrozma (#800) is included as it originates from Ultra Space.
export const ULTRA_BEAST_IDS = new Set<number>([
    793, 794, 795, 796, 797, 798, 799, // Nihilego → Guzzlord
    800,                        // Necrozma
    805, 806,                   // Stakataka, Blacephalon
]);

// Paradox Pokémon — require Time Rift
// Koraidon/Miraidon (1007/1008) are also box legendaries; both gates apply independently.
export const PARADOX_IDS = new Set<number>([
    984, 985, 986, 987, 988, 989,       // Past paradox: Great Tusk → Sandy Shocks
    990, 991, 992, 993, 994, 995,       // Future paradox: Iron Treads → Iron Thorns
    1005, 1006,                         // Roaring Moon, Iron Valiant
    1007, 1008,                         // Koraidon, Miraidon
    1009, 1010,                         // Walking Wake, Iron Leaves
    1020, 1021, 1022, 1023,             // Gouging Fire, Raging Bolt, Iron Boulder, Iron Crown
]);

// Stone-only evolutions — require the matching evolutionary stone item.
// Key = stone name (lowercase), value = Set of Pokémon IDs.
// Stone item names: "{key.charAt(0).toUpperCase() + key.slice(1)} Stone"
export const STONE_EVO_IDS: Record<string, Set<number>> = {
    fire:    new Set([38, 59, 136, 514, 952]),           // Ninetales, Arcanine, Flareon, Simisear, Scovillain
    water:   new Set([62, 91, 121, 134, 272, 516]),     // Poliwrath, Cloyster, Starmie, Vaporeon, Ludicolo, Simipour
    thunder: new Set([26, 135, 462, 476, 604, 738, 939]), // Raichu, Jolteon, Magnezone, Probopass, Eelektross, Vikavolt, Bellibolt
    leaf:    new Set([45, 71, 103, 275, 470, 512]),     // Vileplume, Victreebel, Exeggutor, Shiftry, Leafeon, Simisage
    moon:    new Set([31, 34, 36, 40, 301, 518]),       // Nidoqueen, Nidoking, Clefable, Wigglytuff, Delcatty, Musharna
    sun:     new Set([182, 192, 547, 549, 695]),        // Bellossom, Sunflora, Whimsicott, Lilligant, Heliolisk
    shiny:   new Set([407, 468, 573, 671]),             // Roserade, Togekiss, Cinccino, Florges
    dusk:    new Set([429, 430, 609, 681]),             // Mismagius, Honchkrow, Chandelure, Aegislash
    dawn:    new Set([475, 478]),                       // Gallade, Froslass
    ice:     new Set([471, 740, 975]),                  // Glaceon, Crabominable, Cetitan
};

// Ordered stone names matching APWorld item ID offsets (6010 + index)
export const STONE_NAMES_ORDERED = [
    'fire', 'water', 'thunder', 'leaf', 'moon', 'sun', 'shiny', 'dusk', 'dawn', 'ice',
] as const;
