// Mapping for base forms that have specific names in pokesprite
export const getPokespriteUrl = (_name: string, id: number, shiny: boolean = false): string => {
    // Official PokeAPI sprites are much more reliable as they use IDs
    const baseUrl = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';

    // We can also use official-artwork for higher quality
    // const baseUrl = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork';

    if (shiny) {
        return `${baseUrl}/shiny/${id}.png`;
    }
    return `${baseUrl}/${id}.png`;
};
