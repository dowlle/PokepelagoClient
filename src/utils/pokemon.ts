/**
 * Form suffixes that should be removed from the display name.
 * These are common suffixes in PokeAPI that the user finds redundant.
 */
const FORM_SUFFIXES = [
    '-normal',
    '-altered',
    '-land',
    '-average',
    '-ordinary',
    '-standard',
    '-standard-mode',
    '-unbound',
    '-solo',
    '-meteor',
    '-disguised',
    '-amped',
    '-low-key',
    '-full-belly',
    '-noice',
    '-crowned',
    '-single-strike',
    '-rapid-strike',
    '-ice-rider',
    '-shadow-rider',
    '-hero',
    '-zero',
    '-normal-form',
    '-green-plumage',
    '-yellow-plumage',
    '-white-plumage',
    '-blue-plumage',
    '-combat-breed',
    '-blaze-breed',
    '-aqua-breed',
    '-limited',
    '-unlimited',
    '-original',
    '-complete',
    '-10',
    '-50',
    '-incarnate',
    '-therian',
    '-aria',
    '-pirouette',
    '-resolute',
    '-standard',
    '-active',
    '-neutral',
    '-original',
    '-small',
    '-average',
    '-large',
    '-super',
    '-curly',
    '-droopy',
    '-stretchy',
    '-two-segment',
    '-three-segment',
    '-family-of-three',
    '-family-of-four',
    '-teal-mask',
    '-wellspring-mask',
    '-hearthflame-mask',
    '-cornerstone-mask'
];

/**
 * Special cases where the hyphen should be preserved or handled differently.
 */
const SPECIAL_CASES: Record<string, string> = {
    'ho-oh': 'Ho-Oh',
    'porygon-z': 'Porygon-Z',
    'jangmo-o': 'Jangmo-o',
    'hakamo-o': 'Hakamo-o',
    'kommo-o': 'Kommo-o',
    'nidoran-f': 'Nidoran-F',
    'nidoran-m': 'Nidoran-M',
    'mr-mime': 'Mr. Mime',
    'mr-rime': 'Mr. Rime',
    'mime-jr': 'Mime Jr.',
    'sirfetchd': "Sirfetch'd",
    'farfetchd': "Farfetch'd",
    'flabebe': 'Flabébé',
    'type-null': 'Type: Null',
    'tapu-koko': 'Tapu Koko',
    'tapu-lele': 'Tapu Lele',
    'tapu-bulu': 'Tapu Bulu',
    'tapu-fini': 'Tapu Fini',
    'iron-valiant': 'Iron Valiant',
    'iron-thorns': 'Iron Thorns',
    'iron-jugulis': 'Iron Jugulis',
    'iron-moth': 'Iron Moth',
    'iron-hands': 'Iron Hands',
    'iron-bundle': 'Iron Bundle',
    'iron-treads': 'Iron Treads',
    'roaring-moon': 'Roaring Moon',
    'sandy-shocks': 'Sandy Shocks',
    'flutter-mane': 'Flutter Mane',
    'brute-bonnet': 'Brute Bonnet',
    'slither-wing': 'Slither Wing',
    'scream-tail': 'Scream Tail',
    'great-tusk': 'Great Tusk',
    'walking-wake': 'Walking Wake',
    'iron-leaves': 'Iron Leaves',
    'raging-bolt': 'Raging Bolt',
    'iron-crown': 'Iron Crown',
    'gouging-fire': 'Gouging Fire',
    'iron-boulder': 'Iron Boulder',
    'wo-chien': 'Wo-Chien',
    'chien-pao': 'Chien-Pao',
    'ting-lu': 'Ting-Lu',
    'chi-yu': 'Chi-Yu'
};

/**
 * Returns a clean, displayable name for a Pokémon, stripping redundant form suffixes.
 */
export const getCleanName = (name: string): string => {
    const lowerName = name.toLowerCase();

    // Check special cases first
    if (SPECIAL_CASES[lowerName]) {
        return SPECIAL_CASES[lowerName];
    }

    let cleanName = lowerName;

    // Remove redundant suffixes
    // We sort by length descending to match longest suffixes first (e.g. -standard-mode before -standard)
    const sortedSuffixes = [...FORM_SUFFIXES].sort((a, b) => b.length - a.length);
    for (const suffix of sortedSuffixes) {
        if (cleanName.endsWith(suffix)) {
            cleanName = cleanName.slice(0, -suffix.length);
            break;
        }
    }

    // Special handling for Deoxys, Palafin, etc. forms which might have complex patterns
    if (cleanName.startsWith('deoxys-')) return 'Deoxys';
    if (cleanName.startsWith('palafin-')) return 'Palafin';
    if (cleanName.startsWith('tatsugiri-')) return 'Tatsugiri';
    if (cleanName.startsWith('dudunsparce-')) return 'Dudunsparce';
    if (cleanName.startsWith('maushold-')) return 'Maushold';
    if (cleanName.startsWith('ogerpon-')) return 'Ogerpon';
    if (cleanName.startsWith('squawkabilly-')) return 'Squawkabilly';

    // Capitalize words
    return cleanName
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

/**
 * Extracts a Pokémon ID from a filename, handle variations like "386-normal.png" or "0386.png"
 */
export const parsePokemonIdFromFileName = (fileName: string): number | null => {
    // Typical patterns: "1.png", "001.png", "1-normal.png", "1_shiny.png", "shiny_1.gif"
    const nameOnly = fileName.split('.')[0];

    // Check for "shiny_1" pattern
    if (nameOnly.startsWith('shiny_')) {
        const idPart = nameOnly.replace('shiny_', '').split(/[-_]/)[0];
        const id = parseInt(idPart);
        return isNaN(id) ? null : id;
    }

    // Check for "1-normal" or "1_shiny" or just "1"
    const idPart = nameOnly.split(/[-_]/)[0];
    const id = parseInt(idPart);
    return isNaN(id) ? null : id;
};
