import {
  ReadableGATTCharacteristicGateway,
  GATTCharacteristicGatewayDerived,
  GATTServiceGateway,
  WriteableGATTCharacteristicGateway,
  DataViewReader,
  DataViewWriter,
  DecodedCharacteristicValueChangedEvent,
} from './common.js';

import { aTimeout } from '../util.js';
import { BaseDecodedMessage } from './types.js';

/*
 * object Client Server
 * Client->Server: Init 0x03-10
 * Server->Client: Challenge 0x03-10-{C2}-{C1}
 * Client->Server: Response 0x03-11-{R2}-{R1}
 * Server->Client: Finished 0x03-11-(FE|FF)
 *
 * +---------+                        +---------+
 * | Client  |                        | Server  |
 * +---------+                        +---------+
 *      |                                  |
 *      | Init 0x03-10                     |
 *      |--------------------------------->|
 *      |                                  |
 *      |      Challenge 0x03-10-{C2}-{C1} |
 *      |<---------------------------------|
 *      |                                  |
 *      | Response 0x03-11-{R2}-{R1}       |
 *      |--------------------------------->|
 *      |                                  |
 *      |         Finished 0x03-11-(FE|FF) |
 *      |<---------------------------------|
 *      |                                  |
 */

const UINT16MODULO = 65536;

const calculateResponseCode = (challenge: number): number => {
  const n = challenge % 11;
  const m = ((challenge << n) | (challenge >> (16 - n))) % UINT16MODULO;
  const x = ((challenge + 38550) ^ m) % UINT16MODULO;
  return x % 65336;
};

export type SteeringValue = {
  angle: number;
};

export type SteeringDataMessage = {
  type: typeof SteeringDataGateway.characteristicLabel;
  value: SteeringValue;
} & BaseDecodedMessage;

type HandshakeChallengeData = {
  type: HandshakeOpCode.InitChallenge;
  challenge: number;
};

type HandshakeFinishedData = {
  type: HandshakeOpCode.ResponseFinished;
  statusCode: StatusCode;
};

type HandshakeReadData = HandshakeChallengeData | HandshakeFinishedData;

// TODO make this consistent
type HandshakeChallengeMessage = {
  type: HandshakeReadGateway['characteristicId'];
  value: HandshakeChallengeData;
  timeStamp: number;
} & BaseDecodedMessage;

enum HandshakeOpCode {
  InitChallenge = 0x1003,
  ResponseFinished = 0x1103,
}

enum StatusCode {
  Accepted = 0xff,
  Rejected = 0xfe,
}

export class SteeringServiceGateway extends GATTServiceGateway {
  // static serviceId = '347b0001-f315-4f60-9fb8-838830daea50';
  static serviceId = '347b0001-7635-408b-8918-8ff3949ce592';
  characteristicDefs: [string, GATTCharacteristicGatewayDerived][] = [
    [SteeringDataGateway.characteristicId, SteeringDataGateway],
    [HandshakeWriteGateway.characteristicId, HandshakeWriteGateway],
    [HandshakeReadGateway.characteristicId, HandshakeReadGateway],
  ];

  get steeringDataP() {
    return (async () =>
      (await this.characteristicsP).get(
        SteeringDataGateway.characteristicId,
      ) as SteeringDataGateway)();
  }

  get handshakeWrite() {
    return (async () =>
      (await this.characteristicsP).get(
        HandshakeWriteGateway.characteristicId,
      ) as HandshakeWriteGateway)();
  }

  get handshakeRead() {
    return (async () =>
      (await this.characteristicsP).get(
        HandshakeReadGateway.characteristicId,
      ) as HandshakeReadGateway)();
  }

  constructor() {
    super(SteeringServiceGateway.serviceId);
    this.handshake();
  }

  async handshake() {
    const handshakeWrite = await this.handshakeWrite;
    const handshakeRead = await this.handshakeRead;
    const handshakeChallengeDataP = new Promise((resolve, reject) => {
      handshakeRead.addEventListener(
        DecodedCharacteristicValueChangedEvent.type,
        (
          evt: DecodedCharacteristicValueChangedEvent<HandshakeChallengeMessage>,
        ) => {
          resolve(evt.detail.message.value);
        },
        { once: true },
      );
      handshakeRead.characteristic.startNotifications();
    });

    // Geriatric protocol
    await aTimeout(500);
    handshakeWrite.initiateChallenge();
    const handshakeChallengeData =
      (await handshakeChallengeDataP) as HandshakeChallengeData;

    const handshakeFinishedDataP = new Promise((resolve, reject) => {
      handshakeRead.addEventListener(
        DecodedCharacteristicValueChangedEvent.type,
        (
          evt: DecodedCharacteristicValueChangedEvent<HandshakeChallengeMessage>,
        ) => {
          resolve(evt.detail.message.value);
        },
        { once: true },
      );
    });
    const responseCode = calculateResponseCode(
      handshakeChallengeData.challenge,
    );

    await aTimeout(500);
    handshakeWrite.respondToChallenge(responseCode);

    const handshakeFinishedData =
      (await handshakeFinishedDataP) as HandshakeFinishedData;

    if (handshakeFinishedData.statusCode === StatusCode.Rejected) {
      throw new Error('Handshake rejected');
    } else {
      console.log('Handshake finished');
    }
  }
}

export class SteeringDataGateway extends ReadableGATTCharacteristicGateway {
  static characteristicId = '347b0030-7635-408b-8918-8ff3949ce592';
  static characteristicLabel = 'steering_data';

  static parseSteeringData(dataView: DataView): SteeringValue {
    const angle = dataView.getFloat32(0, true);
    return {
      angle,
    };
  }

  constructor(characteristic: BluetoothRemoteGATTCharacteristic) {
    super(
      characteristic,
      SteeringDataGateway.characteristicId,
      SteeringDataGateway.characteristicLabel,
    );
  }

  decodeValue(dataView: DataView): SteeringValue {
    return SteeringDataGateway.parseSteeringData(dataView);
  }
}

export class HandshakeWriteGateway extends WriteableGATTCharacteristicGateway {
  static characteristicId = '347b0031-7635-408b-8918-8ff3949ce592';

  constructor(characteristic: BluetoothRemoteGATTCharacteristic) {
    super(characteristic, HandshakeWriteGateway.characteristicId);
  }

  initiateChallenge() {
    return this.characteristic.writeValueWithResponse(
      new Uint8Array([0x03, 0x10]),
    );
  }

  respondToChallenge(responseCode: number) {
    const writer = new DataViewWriter(4 + 4, true);
    writer.writeUint8(0x03);
    writer.writeUint8(0x11);
    writer.writeUint16(responseCode);
    return this.characteristic.writeValueWithResponse(
      writer.getClampedDataView(),
    );
  }
}

export class HandshakeReadGateway extends ReadableGATTCharacteristicGateway {
  static characteristicId = '347b0032-7635-408b-8918-8ff3949ce592';

  constructor(characteristic: BluetoothRemoteGATTCharacteristic) {
    super(characteristic, HandshakeReadGateway.characteristicId);
  }

  decodeValue(dataView: DataView): HandshakeReadData {
    console.debug('HandshakeReadGateway.decodeValue', dataView);
    const reader = new DataViewReader(dataView, true);

    const opCode: number = reader.readUint16();
    switch (opCode) {
      case HandshakeOpCode.InitChallenge:
        const challenge = reader.readUint16();
        return {
          type: opCode,
          challenge,
        };
      case HandshakeOpCode.ResponseFinished:
        const statusCode: StatusCode = reader.readUint8();
        return {
          type: opCode,
          statusCode,
        };
      default:
        throw new Error(`Unknown op code: ${opCode.toString(16)}`);
    }
  }
}
