import {
  Decoder as CborDecoder,
  Encoder as CborEncoder,
} from 'https://cdn.skypack.dev/cbor-x?dts';

import { BaseDecodedMessage } from '../static/ble/types.ts';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const cborEncoder = new CborEncoder({ useRecords: false });
const cborDecoder = new CborDecoder({ useRecords: false });

type BeamNGMessages = BeamNGMessage[];
type BeamNGMessage = [string, number | string | boolean];

const steeringDataToBeamNG = (message: BaseDecodedMessage): BeamNGMessages => [
  ['STR', message.value?.angle],
];

const hrDataToBeamNG = (message: BaseDecodedMessage): BeamNGMessages => [
  ['HR', message.value?.heartRateValue],
];

const indoorBikeDataToBeamNG = (
  message: BaseDecodedMessage,
): BeamNGMessages => [
  ['POW', message.value?.instantaneousPower],
  ['CAD', message.value?.instantaneousCadence],
];

const slopeToIndoorBikeSimulationMessage = (value: number) => ({
  type: 'indoor_bike_simulation',
  timeStamp: Date.now(),
  value: {
    grade: value,
  },
});

const messageTypeToFunctionMapping: Record<
  string,
  (message: BaseDecodedMessage) => BeamNGMessages
> = {
  steering_data: steeringDataToBeamNG,
  heart_rate_measurement: hrDataToBeamNG,
  indoor_bike_data: indoorBikeDataToBeamNG,
};

export const cborToBeamNG = (messageCBOR: ArrayBuffer): Uint8Array => {
  const message = cborDecoder.decode(new Uint8Array(messageCBOR));
  if (message.type === undefined) {
    throw new Error('Message has no type');
  }
  if (messageTypeToFunctionMapping[message.type] === undefined) {
    throw new Error(`Message type ${message.type} is not supported`);
  }
  const beamNGData = messageTypeToFunctionMapping[message.type](message);
  const beamNGString = beamNGData.map((tuple) => tuple.join(':')).join('\n');
  return textEncoder.encode(`${beamNGString}\n`);
};

export const beamNGToCbor = (messageBeamNG: Uint8Array): ArrayBuffer[] => {
  const beamNGString = textDecoder.decode(messageBeamNG);
  const beamNGData: BeamNGMessages = beamNGString
    .split('\n')
    .map((line) => {
      const [type, value] = line.split(':');
      return [type, value];
    })
    .filter((line) => line.length === 2) as BeamNGMessages;
  const messages: BaseDecodedMessage[] = [];
  for (let [type, value] of beamNGData) {
    if (type === 'SLOPE') {
      messages.push(
        slopeToIndoorBikeSimulationMessage(Number.parseFloat(value as string)),
      );
    }
  }
  const messagesCBOR: ArrayBuffer[] = messages.map(
    (message) => cborEncoder.encode(message) as ArrayBuffer,
  );
  return messagesCBOR;
};
