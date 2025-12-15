// import { HRMMessage } from './hrs.js';
// import { PowerMessage } from './power.js';
// import { IndoorBikeDataMessage } from './ftms.js';
// import { SteeringDataMessage } from './sterzo.js';

export type FlagDefinition<FlagType extends number | boolean> = {
  index: number;
  mask?: number;
  parser?: (value: number) => FlagType;
};

export type BaseDecodedValue = {
  [key: string]: any;
};

export type BaseDecodedMessage = {
  type: string;
  timeStamp: number;
  value: BaseDecodedValue;
};

export type DecodedCharacteristicValueChangedEventDetail<
  T extends BaseDecodedMessage,
> = {
  characteristic: BluetoothRemoteGATTCharacteristic;
  message: T;
};

// export type DecodedMessage =
//   | HRMMessage
//   | PowerMessage
//   | IndoorBikeDataMessage
//   | SteeringDataMessage;
