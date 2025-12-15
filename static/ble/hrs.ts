import {
  parseFlags,
  GATTServiceGateway,
  ReadableGATTCharacteristicGateway,
  CharacteristicValueChangedEvent,
  GATTCharacteristicGatewayDerived,
  booleanParser,
  DataViewReader,
} from './common.js';

import { BaseDecodedMessage } from './types.js';

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
  type: typeof HeartRateMeasurementGateway.characteristicId;
  value: HRMValue;
} & BaseDecodedMessage;

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

    const value: HRMValue = {
      ...flags,
      heartRateValue,
    } as HRMValue; //TODO: fix this

    if (rrIntervalPresent) {
      value.rrIntervals = [];
      while (reader.byteIndex + 1 < dataView.byteLength) {
        value.rrIntervals.push(reader.readUint16());
      }
    }

    return value;
  }

  constructor(characteristic: BluetoothRemoteGATTCharacteristic) {
    super(characteristic, HeartRateMeasurementGateway.characteristicId);
  }

  override decodeValue(dataView: DataView): HRMValue {
    return HeartRateMeasurementGateway.parseHRMValue(dataView);
  }
}
