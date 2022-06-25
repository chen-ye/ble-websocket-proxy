import {
  booleanParser,
  DataViewReader,
  ReadableGATTCharacteristicGateway,
  GATTCharacteristicGatewayDerived,
  GATTServiceGateway,
  invBooleanParser,
  DecodedMessage,
  parseFlags,
  WriteableGATTCharacteristicGateway,
  DataViewWriter,
} from './common.js';

const indoorBikeDataFlagDefs = {
  instantaneousSpeedPresent: { index: 0, parser: invBooleanParser },
  averageSpeedPresent: { index: 1, parser: booleanParser },
  instantaneousCadencePresent: { index: 2, parser: booleanParser }, //note: pdf spec says this is inverted
  averageCadencePresent: { index: 3, parser: booleanParser },
  totalDistancePresent: { index: 4, parser: booleanParser },
  resistanceLevelPresent: { index: 5, parser: booleanParser },
  instantaneousPowerPresent: { index: 6, parser: booleanParser },
  averagePowerPresent: { index: 7, parser: booleanParser },
  expendedEnergyPresent: { index: 8, parser: booleanParser },
  heartRatePresent: { index: 9, parser: booleanParser },
  metabolicEquivalentPresent: { index: 10, parser: booleanParser },
  elapsedTimePresent: { index: 11, parser: booleanParser },
  remainingTimePresent: { index: 12, parser: booleanParser },
};

type IndoorBikeFlags = {
  instantaneousSpeedPresent: boolean;
  averageSpeedPresent: boolean;
  instantaneousCadencePresent: boolean;
  averageCadencePresent: boolean;
  totalDistancePresent: boolean;
  resistanceLevelPresent: boolean;
  instantaneousPowerPresent: boolean;
  averagePowerPresent: boolean;
  expendedEnergyPresent: boolean;
  heartRatePresent: boolean;
  metabolicEquivalentPresent: boolean;
  elapsedTimePresent: boolean;
  remainingTimePresent: boolean;
};

type IndoorBikeValue = IndoorBikeFlags & {
  instantaneousSpeed?: number;
  averageSpeed?: number;
  instantaneousCadence?: number;
  averageCadence?: number;
  totalDistance?: number;
  resistanceLevel?: number;
  instantaneousPower?: number;
  averagePower?: number;
  totalEnergy?: number;
  energyPerHour?: number;
  energyPerMinute?: number;
  heartRate?: number;
  metabolicEquivalent?: number;
  elapsedTime?: number;
  remainingTime?: number;
};

export type IndoorBikeDataMessage = {
  value: IndoorBikeValue;
} & DecodedMessage;

export class FTMSServiceGateway extends GATTServiceGateway {
  static serviceId = 'fitness_machine';
  characteristicDefs: [string, GATTCharacteristicGatewayDerived][] = [
    [IndoorBikeDataGateway.characteristicId, IndoorBikeDataGateway],
    [
      FitnessMachineControlPointGateway.characteristicId,
      FitnessMachineControlPointGateway,
    ],
  ];

  get indoorBikeDataP() {
    return (async () =>
      (await this.characteristicsP).get(
        IndoorBikeDataGateway.characteristicId,
      ) as IndoorBikeDataGateway)();
  }

  get fitnessMachineControlPointP() {
    return (async () =>
      (await this.characteristicsP).get(
        FitnessMachineControlPointGateway.characteristicId,
      ) as FitnessMachineControlPointGateway)();
  }

  constructor() {
    super(FTMSServiceGateway.serviceId);
  }
}

export class IndoorBikeDataGateway extends ReadableGATTCharacteristicGateway {
  static characteristicId = 'indoor_bike_data';
  static parseIndoorBikeData(dataView: DataView): IndoorBikeValue {
    const reader = new DataViewReader(dataView, true);

    const rawFlags = reader.readUint16();
    const flags = parseFlags(rawFlags, indoorBikeDataFlagDefs);

    const {
      instantaneousSpeedPresent,
      averageSpeedPresent,
      instantaneousCadencePresent,
      averageCadencePresent,
      totalDistancePresent,
      resistanceLevelPresent,
      instantaneousPowerPresent,
      averagePowerPresent,
      expendedEnergyPresent,
      heartRatePresent,
      metabolicEquivalentPresent,
      elapsedTimePresent,
      remainingTimePresent,
    } = flags;

    let instantaneousSpeed: number | undefined = undefined;
    if (instantaneousSpeedPresent) {
      instantaneousSpeed = reader.readUint16() * 0.01;
    }

    let averageSpeed: number | undefined = undefined;
    if (averageSpeedPresent) {
      averageSpeed = reader.readUint16() * 0.01;
    }

    let instantaneousCadence: number | undefined = undefined;
    if (instantaneousCadencePresent) {
      instantaneousCadence = reader.readUint16() / 2;
    }

    let averageCadence: number | undefined = undefined;
    if (averageCadencePresent) {
      averageCadence = reader.readUint16() / 2;
    }

    let totalDistance: number | undefined = undefined;
    if (totalDistancePresent) {
      totalDistance = reader.readUint32();
    }

    let resistanceLevel: number | undefined = undefined;
    if (resistanceLevelPresent) {
      resistanceLevel = reader.readUint16();
    }

    let instantaneousPower: number | undefined = undefined;
    if (instantaneousPowerPresent) {
      instantaneousPower = reader.readUint16();
    }

    let averagePower: number | undefined = undefined;
    if (averagePowerPresent) {
      averagePower = reader.readUint16();
    }

    let totalEnergy: number | undefined = undefined;
    if (expendedEnergyPresent) {
      totalEnergy = reader.readInt16();
    }

    let energyPerHour: number | undefined = undefined;
    if (expendedEnergyPresent) {
      energyPerHour = reader.readInt16();
    }

    let energyPerMinute: number | undefined = undefined;
    if (expendedEnergyPresent) {
      energyPerMinute = reader.readUint8();
    }

    let heartRate: number | undefined = undefined;
    if (heartRatePresent) {
      heartRate = reader.readUint16();
    }

    let metabolicEquivalent: number | undefined = undefined;
    if (metabolicEquivalentPresent) {
      metabolicEquivalent = reader.readUint8();
    }

    let elapsedTime: number | undefined = undefined;
    if (elapsedTimePresent) {
      elapsedTime = reader.readUint16();
    }

    let remainingTime: number | undefined = undefined;
    if (remainingTimePresent) {
      remainingTime = reader.readUint16();
    }

    return {
      ...flags,
      instantaneousSpeed,
      averageSpeed,
      instantaneousCadence,
      averageCadence,
      totalDistance,
      resistanceLevel,
      instantaneousPower,
      averagePower,
      totalEnergy,
      energyPerHour,
      energyPerMinute,
      heartRate,
      metabolicEquivalent,
      elapsedTime,
      remainingTime,
    };
  }

  constructor(characteristic: BluetoothRemoteGATTCharacteristic) {
    super(characteristic, IndoorBikeDataGateway.characteristicId);
  }

  override decodeValue(dataView: DataView): IndoorBikeValue {
    return IndoorBikeDataGateway.parseIndoorBikeData(dataView);
  }
}

export class FitnessMachineControlPointGateway extends WriteableGATTCharacteristicGateway {
  static characteristicId = 'fitness_machine_control_point';

  constructor(characteristic: BluetoothRemoteGATTCharacteristic) {
    super(characteristic, FitnessMachineControlPointGateway.characteristicId);
  }

  requestControl() {
    return this.characteristic.writeValueWithResponse(new Uint8Array([0x00]));
  }

  reset() {
    return this.characteristic.writeValueWithResponse(new Uint8Array([0x01]));
  }

  setTargetSpeed({ speed }: { speed: number }) {
    const writer = new DataViewWriter(1 + 2, true);
    writer.writeUint8(0x02);
    writer.writeUint16(speed / 0.01);
    return this.characteristic.writeValueWithResponse(
      writer.getClampedDataView(),
    );
  }

  setTargetInclination({ inclination }: { inclination: number }) {
    const writer = new DataViewWriter(1 + 2, true);
    writer.writeUint8(0x03);
    writer.writeInt16(inclination / 0.1);
    return this.characteristic.writeValueWithResponse(
      writer.getClampedDataView(),
    );
  }

  setTargetResistanceLevel({ resistanceLevel }: { resistanceLevel: number }) {
    const writer = new DataViewWriter(1 + 1, true);
    writer.writeUint8(0x04);
    writer.writeUint8(resistanceLevel / 0.1);
    return this.characteristic.writeValueWithResponse(
      writer.getClampedDataView(),
    );
  }

  setTargetPower({ power }: { power: number }) {
    const writer = new DataViewWriter(1 + 2, true);
    writer.writeUint8(0x05);
    writer.writeUint16(power);
    return this.characteristic.writeValueWithResponse(
      writer.getClampedDataView(),
    );
  }

  setTargetHeartRate({ heartRate }: { heartRate: number }) {
    const writer = new DataViewWriter(1 + 1, true);
    writer.writeUint8(0x06);
    writer.writeUint8(heartRate);
    return this.characteristic.writeValueWithResponse(
      writer.getClampedDataView(),
    );
  }

  startOrResume() {
    return this.characteristic.writeValueWithResponse(new Uint8Array([0x07]));
  }

  stopOrPause() {
    return this.characteristic.writeValueWithResponse(new Uint8Array([0x08]));
  }

  setTargetExpendedEnergy({ energy }: { energy: number }) {
    const writer = new DataViewWriter(1 + 2, true);
    writer.writeUint8(0x09);
    writer.writeUint16(energy);
    return this.characteristic.writeValueWithResponse(
      writer.getClampedDataView(),
    );
  }

  setIndoorBikeSimulationParameters({
    windSpeed,
    grade,
    rollingResistance,
    windResistance,
  }: {
    windSpeed: number;
    grade: number;
    rollingResistance: number;
    windResistance: number;
  }) {
    const writer = new DataViewWriter(1 + 2 + 2 + 1 + 1, true);
    writer.writeUint8(0x11);
    writer.writeInt16(windSpeed / 0.001);
    writer.writeInt16(grade / 0.01);
    writer.writeUint8(rollingResistance / 0.0001);
    writer.writeUint8(windResistance / 0.01);
    return this.characteristic.writeValueWithResponse(
      writer.getClampedDataView(),
    );
  }
}
