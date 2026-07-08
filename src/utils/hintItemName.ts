/**
 * Map a gate "reason" string to the canonical Archipelago item name used by
 * the `!hint` command.
 *
 * Background (Point 4 / hint bug): `isPokemonGuessable` in GameContext builds a
 * `reasons` array of human-readable gate-failure strings (e.g. "Need Thunder
 * Stone", "Badges: 3/8", "Daycare: 1/2"). The "Missing Requirements" badges in
 * PokemonDetails let the player click a gate to send `!hint <item>` to the AP
 * server. The bug was that the *display reason string* was passed straight to
 * `!hint`, so the server received e.g. `!hint Need Thunder Stone`, which matches
 * no item. The server expects the canonical item name (`Thunder Stone`).
 *
 * The canonical AP item names are defined in the APWorld at
 * `worlds/pokepelago/Items.py` (do NOT edit that repo; this mirrors its names):
 *   - Stones:   "Fire Stone", "Water Stone", "Thunder Stone", "Leaf Stone",
 *               "Moon Stone", "Sun Stone", "Shiny Stone", "Dusk Stone",
 *               "Dawn Stone", "Ice Stone"
 *   - Gates:    "Gym Badge", "Link Cable", "Daycare", "Ultra Wormhole",
 *               "Time Rift", "Fossil Restorer"
 *   - Region passes: "{Region} Pass"
 *   - Type keys:     "{Type} Type Key"
 *   - Route keys:    "{display} Key"
 *   - Master Ball:   "Master Ball"
 *
 * Progressive items (Gym Badge, Daycare) are hinted by their base item name,
 * not by the per-level display string ("Badges: 3/8" / "Daycare: 1/2").
 *
 * This mapper only normalizes the gate-reason strings that come out of
 * `gateReasons`. Strings that are already canonical item names (region pass,
 * type key, route key, line unlock, Link Cable, Fossil Restorer, Ultra
 * Wormhole, Time Rift) are returned unchanged.
 */
export function hintItemNameForReason(reason: string): string {
    // Stones: "Need Thunder Stone" -> "Thunder Stone"
    if (reason.startsWith('Need ') && reason.endsWith(' Stone')) {
        return reason.slice('Need '.length);
    }

    // Badge gating (progressive): "Badges: 3/8" -> "Gym Badge"
    if (reason.startsWith('Badges:')) {
        return 'Gym Badge';
    }

    // Daycare (progressive): "Daycare: 1/2" -> "Daycare"
    if (reason.startsWith('Daycare:')) {
        return 'Daycare';
    }

    // Already-canonical gate item names pass through unchanged
    // (Link Cable, Fossil Restorer, Ultra Wormhole, Time Rift, and any
    // region/type/route/line item name handled at the call site).
    return reason;
}
