import { Client, itemsHandlingFlags } from 'archipelago.js';

const LOCATION_OFFSET = 8571000;

async function runTest() {
    const client = new Client();

    console.log("Connecting to Archipelago...");

    try {
        await client.login(
            "localhost:38281",
            "AshKetchum",
            "Pokepelago",
            {
                items_handling: itemsHandlingFlags.REMOTE_ALL,
                version: { major: 0, minor: 5, build: 1, class: "Version" }
            }
        );
    } catch (e) {
        console.error("Connection failed:", e);
        return;
    }

    console.log("Connected! Checking Oak's Lab Locations (500-519)...");

    // Check Oak's Lab
    for (let i = 500; i < 520; i++) {
        client.check(LOCATION_OFFSET + i);
    }

    // Wait 2 seconds for server to process initial items
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log("Rapid firing 151 Pokemon guesses...");

    // Check all 151 Pokemon
    // We send them in small batches to not flood the socket perfectly identically
    for (let i = 1; i <= 151; i++) {
        client.check(LOCATION_OFFSET + i);
        // Add a tiny delay every 10 guesses
        if (i % 10 === 0) {
            await new Promise(resolve => setTimeout(resolve, 50));
        }
    }

    console.log("Finished sending 151 Pokemon location checks.");

    // Wait a bit before exiting
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Status 30 = CLIENT_GOAL (Win)
    client.updateStatus(30);
    console.log("Sent completion status.");

    client.socket.disconnect();
    console.log("Disconnected.");
    process.exit(0);
}

runTest();
