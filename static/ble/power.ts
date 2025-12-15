import {
  booleanParser,
  DataViewReader,
  ReadableGATTCharacteristicGateway,
  GATTCharacteristicGatewayDerived,
  GATTServiceGateway,
  parseFlags,
} from './common.js';

import { BaseDecodedMessage } from './types.js';

const cyclingPowerMeasurementFlagDefs = {
  pedalPowerBalancePresent: { index: 0, parser: booleanParser },
  pedalPowerBalanceReference: { index: 1 },
  accumulatedTorquePresent: { index: 2, parser: booleanParser },
  accumulatedTorqueSource: { index: 3 },
  wheelRevolutionDataPresent: { index: 4, parser: booleanParser },
  crankRevolutionDataPresent: { index: 5, parser: booleanParser },
  extremeForceMagnitudesPresent: { index: 6, parser: booleanParser },
  extremeTorqueMagnitudesPresent: { index: 7, parser: booleanParser },
  extremeAnglesPresent: { index: 8, parser: booleanParser },
  topDeadSpotAnglePresent: { index: 9, parser: booleanParser },
  bottomDeadSpotAnglePresent: { index: 10, parser: booleanParser },
  accumulatedEnergyPresent: { index: 11, parser: booleanParser },
  offsetCompensationIndicator: { index: 12, parser: booleanParser },
};

enum PedalPowerBalanceReferenceEnum {
  Unknown = 0,
  Left = 1,
}

enum AccumulatedTorqueSourceEnum {
  WheelBased = 0,
  CrankBased,
}

type PowerFlags = {
  pedalPowerBalancePresent: boolean;
  pedalPowerBalanceReference: PedalPowerBalanceReferenceEnum;
  accumulatedTorquePresent: boolean;
  accumulatedTorqueSource: AccumulatedTorqueSourceEnum;
  wheelRevolutionDataPresent: boolean;
  crankRevolutionDataPresent: boolean;
  extremeForceMagnitudesPresent: boolean;
  extremeTorqueMagnitudesPresent: boolean;
  extremeAnglesPresent: boolean;
  topDeadSpotAnglePresent: boolean;
  bottomDeadSpotAnglePresent: boolean;
  accumulatedEnergyPresent: boolean;
  offsetCompensationIndicator: boolean;
};

type PowerValue = PowerFlags & {
  instantaneousPower: number;
  pedalPowerBalance?: number;
  accumulatedTorque?: number;
  numCompleteWheelRevolutions?: number;
  lastWheelEventTime?: number;
  numCompleteCrankRevolutions?: number;
  lastCrankEventTime?: number;
};

export type PowerMessage = {
  type: typeof CyclingPowerMeasurementGateway.characteristicId;
  value: PowerValue;
} & BaseDecodedMessage;

export class CyclingPowerServiceGateway extends GATTServiceGateway {
  static serviceId = 'cycling_power';
  characteristicDefs: [string, GATTCharacteristicGatewayDerived][] = [
    [
      CyclingPowerMeasurementGateway.characteristicId,
      CyclingPowerMeasurementGateway,
    ],
  ];

  get cyclingPowerMeasurementP() {
    return (async () =>
      (await this.characteristicsP).get(
        CyclingPowerMeasurementGateway.characteristicId,
      ) as CyclingPowerMeasurementGateway)();
  }

  constructor() {
    super(CyclingPowerServiceGateway.serviceId);
  }
}

export class CyclingPowerMeasurementGateway extends ReadableGATTCharacteristicGateway {
  static characteristicId = 'cycling_power_measurement';
  static parsePowerValue(dataView: DataView): PowerValue {
    const reader = new DataViewReader(dataView, true);

    const rawFlags = reader.readUint16();
    const flags = parseFlags<PowerFlags>(
      rawFlags,
      cyclingPowerMeasurementFlagDefs,
    );
    const {
      pedalPowerBalancePresent,
      accumulatedTorquePresent,
      wheelRevolutionDataPresent,
      crankRevolutionDataPresent,
    } = flags;

    const instantaneousPower = reader.readInt16();

    const value: PowerValue = {
      ...flags,
      instantaneousPower,
    };

    if (pedalPowerBalancePresent) {
      value.pedalPowerBalance = reader.readUint8() / 2;
    }

    if (accumulatedTorquePresent) {
      value.accumulatedTorque = reader.readUint16() / 32;
    }

    if (wheelRevolutionDataPresent) {
      value.numCompleteWheelRevolutions = reader.readUint32();
      value.lastWheelEventTime = reader.readUint16() / 2048;
    }

    if (crankRevolutionDataPresent) {
      value.numCompleteCrankRevolutions = reader.readUint16();
      value.lastCrankEventTime = reader.readUint16() / 1024;
    }

    return value;
  }

  constructor(characteristic: BluetoothRemoteGATTCharacteristic) {
    super(characteristic, CyclingPowerMeasurementGateway.characteristicId);
  }

  override decodeValue(dataView: DataView): { [key: string]: any } {
    return CyclingPowerMeasurementGateway.parsePowerValue(dataView);
  }
}
