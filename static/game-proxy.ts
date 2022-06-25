import { Decoder } from 'https://cdn.skypack.dev/cbor-x?dts';

const decoder = new Decoder();

const websocketURL = new URL('/ws/game', import.meta.url);
websocketURL.protocol = 'ws';
websocketURL.port = `${8000}`;

const ws = new WebSocket(websocketURL);
ws.addEventListener('message', async (evt) => {
  const data = evt.data as Blob;
  const dataBuffer = await data.arrayBuffer();
  console.log(decoder.decode(new Uint8Array(dataBuffer)), evt);
});
