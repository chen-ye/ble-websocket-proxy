import {
  parseFlags,
  GATTServiceGateway,
  ReadableGATTCharacteristicGateway,
  CharacteristicValueChangedEvent,
  GATTCharacteristicGatewayDerived,
  DecodedMessage,
  booleanParser,
  DataViewReader,
} from './common.js';

const heartRateMeasurementFlagDefs = {
  hrvFormat: { index: 0 },
  sensorContactSupported: { index: 1, parser: booleanParser },
  sensorContactDetected: { index: 2, parser: booleanParser },
  energyExpendedPresent: { index: 3, parser: booleanParser },
  rrIntervalPresent: { index: 4, parser: booleanParser },
};

enum HRVFormatEnum {
  Short = 0,
  Long = 1,
}

type HRMFlags = {
  hrvFormat: HRVFormatEnum;
  sensorContactSupported: boolean;
  sensorContactDetected: boolean;
  energyExpendedPresent: boolean;
  rrIntervalPresent: boolean;
};

type HRMBaseValue = HRMFlags & {
  heartRateValue: number;
  energyExpended?: number;
  rrIntervals: number[];
};

type NoEnergyExpended = {
  energyExpendedPresent: false;
  energyExpended: undefined;
};

type HasEnergyExpended = {
  energyExpendedPresent: true;
  energyExpended: number;
};

type HRMValue = (HasEnergyExpended | NoEnergyExpended) & HRMBaseValue;

export type HRMMessage = {
  value: HRMValue;
} & DecodedMessage;

export class HRSGateway extends GATTServiceGateway {
  static serviceId = 'heart_rate';
  characteristicDefs: [string, GATTCharacteristicGatewayDerived][] = [
    [HeartRateMeasurementGateway.characteristicId, HeartRateMeasurementGateway],
  ];

  get heartRateMeasurementP() {
    return (async () =>
      (await this.characteristicsP).get(
        HeartRateMeasurementGateway.characteristicId,
      ) as HeartRateMeasurementGateway)();
  }

  constructor() {
    super(HRSGateway.serviceId);
  }
}

export class HeartRateMeasurementGateway extends ReadableGATTCharacteristicGateway {
  static characteristicId = 'heart_rate_measurement';
  static parseHRMValue(dataView: DataView): HRMValue {
    const reader = new DataViewReader(dataView, true);

    const rawFlags = reader.readUint8();
    const flags = parseFlags<HRMFlags>(rawFlags, heartRateMeasurementFlagDefs);
    const { hrvFormat, energyExpendedPresent, rrIntervalPresent } = flags;

    const heartRateValue =
      hrvFormat === HRVFormatEnum.Long
        ? reader.readUint16()
        : reader.readUint8();

    let energyExpended: number | undefined = undefined;
    if (energyExpendedPresent) {
      energyExpended = reader.readUint16();
    }

    const rrIntervals: number[] = [];
    if (rrIntervalPresent) {
      while (reader.byteIndex + 1 < dataView.byteLength) {
        rrIntervals.push(reader.readUint16());
      }
    }

    const parsed: HRMBaseValue = {
      ...flags,
      heartRateValue,
      energyExpended,
      rrIntervals,
    };
    return parsed as HRMValue;
  }

  constructor(characteristic: BluetoothRemoteGATTCharacteristic) {
    super(characteristic, HeartRateMeasurementGateway.characteristicId);
  }

  override decodeValue(dataView: DataView): HRMValue {
    return HeartRateMeasurementGateway.parseHRMValue(dataView);
  }
}
