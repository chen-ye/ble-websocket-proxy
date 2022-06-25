import {
  ReadableGATTCharacteristicGateway,
  GATTCharacteristicGatewayDerived,
  GATTServiceGateway,
  DecodedMessage,
  WriteableGATTCharacteristicGateway,
  DataViewReader,
  DataViewWriter,
  DecodedCharacteristicValueChangedEvent,
} from './common.js';

const calculateResponseCode = (challenge: number): number => {
  const n = challenge % 11;
  const m = (challenge << n) | (challenge >> (16 - n));
  const x = (challenge + 38550) ^ m;
  return x % 65336;
};

type SteeringValue = {};

export class SteeringServiceGateway extends GATTServiceGateway {
  // static serviceId = '347b0001-f315-4f60-9fb8-838830daea50';
  static serviceId = '347b0001-7635-408b-8918-8ff3949ce592';
  characteristicDefs: [string, GATTCharacteristicGatewayDerived][] = [
    [SteeringDataGateway.characteristicId, SteeringDataGateway],
    [
      HandshakeInitiateRespondGateway.characteristicId,
      HandshakeInitiateRespondGateway,
    ],
    [HandshakeChallengeGateway.characteristicId, HandshakeChallengeGateway],
  ];

  get steeringDataP() {
    return (async () =>
      (await this.characteristicsP).get(
        SteeringDataGateway.characteristicId,
      ) as SteeringDataGateway)();
  }

  get handshakeInitiateRequestP() {
    return (async () =>
      (await this.characteristicsP).get(
        HandshakeInitiateRespondGateway.characteristicId,
      ) as HandshakeInitiateRespondGateway)();
  }

  get handshakeChallengeP() {
    return (async () =>
      (await this.characteristicsP).get(
        HandshakeChallengeGateway.characteristicId,
      ) as HandshakeChallengeGateway)();
  }

  constructor() {
    super(SteeringServiceGateway.serviceId);
    this.handshake();
  }

  async handshake() {
    const handshakeInitiateRequest = await this.handshakeInitiateRequestP;
    const handshakeChallenge = await this.handshakeChallengeP;
    const handshakeChallengeDataP = new Promise((resolve, reject) => {
      handshakeChallenge.addEventListener(
        DecodedCharacteristicValueChangedEvent.type,
        (
          evt: DecodedCharacteristicValueChangedEvent<HandshakeChallengeMessage>,
        ) => {
          console.log(evt.detail.message);
          handshakeChallenge.characteristic.stopNotifications();
          resolve(evt.detail.message.value);
        },
      );
      handshakeChallenge.characteristic.startNotifications();
    });
    handshakeInitiateRequest.initiateChallenge();
    const handshakeChallengeData =
      (await handshakeChallengeDataP) as HandshakeChallengeData;

    const responseCode = calculateResponseCode(
      handshakeChallengeData.challenge,
    );
    handshakeInitiateRequest.responseToChallenge(responseCode);
  }
}

export class SteeringDataGateway extends ReadableGATTCharacteristicGateway {
  static characteristicId = '347b0030-7635-408b-8918-8ff3949ce592';
  static characteristicLabel = 'steering_data';

  static parseSteeringData(dataView: DataView): SteeringValue {
    console.log([...new Uint8Array(dataView.buffer).values()]);
    return {};
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

export class HandshakeInitiateRespondGateway extends WriteableGATTCharacteristicGateway {
  static characteristicId = '347b0031-7635-408b-8918-8ff3949ce592';

  constructor(characteristic: BluetoothRemoteGATTCharacteristic) {
    super(characteristic, HandshakeInitiateRespondGateway.characteristicId);
  }

  initiateChallenge() {
    return this.characteristic.writeValueWithResponse(
      new Uint8Array([0x03, 0x10]),
    );
  }

  responseToChallenge(responseCode: number) {
    const writer = new DataViewWriter(4 + 4, true);
    writer.writeUint8(0x03);
    writer.writeUint8(0x11);
    writer.writeUint16(responseCode);
    return this.characteristic.writeValueWithResponse(
      writer.getClampedDataView(),
    );
  }
}

type HandshakeChallengeData = {
  opCode: number;
  challenge: number;
};

// TODO make this consistent
type HandshakeChallengeMessage = {
  type: typeof HandshakeChallengeGateway['characteristicId'];
  value: HandshakeChallengeData;
  timeStamp: number;
} & DecodedMessage;

export class HandshakeChallengeGateway extends ReadableGATTCharacteristicGateway {
  // static characteristicId = 'handshake_challenge';
  // static characteristicUUID = '347b0032-7635-408b-8918-8ff3949ce592';
  static characteristicId = '347b0032-7635-408b-8918-8ff3949ce592';

  constructor(characteristic: BluetoothRemoteGATTCharacteristic) {
    super(characteristic, HandshakeChallengeGateway.characteristicId);
  }

  decodeValue(dataView: DataView): HandshakeChallengeData {
    console.log([...new Uint8Array(dataView.buffer).values()]);
    const reader = new DataViewReader(dataView, true);

    const opCode = reader.readUint16();
    const challenge = reader.readUint16();

    console.log(opCode, challenge);
    return {
      opCode,
      challenge,
    };
  }
}
