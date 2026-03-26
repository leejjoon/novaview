import asyncio
import websockets
import json

async def test_novaview():
    uri = "ws://127.0.0.1:8765"
    try:
        async with websockets.connect(uri) as websocket:
            print("Connected to NovaView WebSocket server.")

            # Test 1: Change to magma colormap
            cmd1 = {
                "command": "set_colormap",
                "colormap": "magma",
                "stretch": "log",
                "vmin": 0.0,
                "vmax": 300.0
            }
            print(f"Sending: {cmd1}")
            await websocket.send(json.dumps(cmd1))
            await asyncio.sleep(2)

            # Test 2: Jump somewhere
            cmd2 = {
                "command": "goto_radec",
                "ra": 266.41683,
                "dec": -29.00781,
                "fov": 5.0
            }
            print(f"Sending: {cmd2}")
            await websocket.send(json.dumps(cmd2))
            await asyncio.sleep(2)

            # Test 3: Change survey
            cmd3 = {
                "command": "set_survey",
                "survey": "http://alasky.cds.unistra.fr/DSS/DSSColor"
            }
            print(f"Sending: {cmd3}")
            await websocket.send(json.dumps(cmd3))
            
            print("Finished sending commands.")
    except Exception as e:
        print(f"Connection failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_novaview())
