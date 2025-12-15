import { makeFloat64 as double } from './../cbor.js';
import {
  BaseDecodedMessage,
  BaseDecodedValue,
  DecodedCharacteristicValueChangedEventDetail,
  FlagDefinition,
} from './types.js';

export const identityParser = (value: number) => value;
export const booleanParser = (value: number) => !!value;
export const invBooleanParser = (value: number) => !value;

export const parseFlags = <
  FlagObject extends { [key: string]: number | boolean },
>(
  flags: number,
  flagDefs: {
    [Property in keyof FlagObject]: FlagDefinition<FlagObject[Property]>;
  },
) => {
  return Object.fromEntries(
    Object.entries(flagDefs).map(([id, flagDef]) => [
      id,
      (flagDef.parser ?? identityParser)(
        (flags >> flagDef.index) & (flagDef.mask ?? 0b1),
      ),
    ]),
  ) as FlagObject;
};

export const getUint24 = (
  dataView: DataView,
  byteIndex: number,
  littleEndian: boolean,
) =>
  littleEndian
    ? (dataView.getUint16(byteIndex, littleEndian) << 8) +
      dataView.getUint8(byteIndex + 2)
    : dataView.getUint16(byteIndex, littleEndian) +
      (dataView.getUint8(byteIndex + 2) << 16);

export interface CharacteristicValueChangedEvent extends Event {
  timeStamp: number;
  target: BluetoothRemoteGATTCharacteristic;
}

export abstract class GATTServiceGateway {
  serviceId: string;
  serviceP: Promise<BluetoothRemoteGATTService>;
  characteristicDefs: [string, GATTCharacteristicGatewayDerived][];
  characteristicsP: Promise<Map<string, GATTCharacteristicGateway>>;

  constructor(serviceId: string) {
    this.serviceId = serviceId;
    this.serviceP = this.initService();
    this.characteristicsP = this.initCharacteristics();
  }

  private async initService(): Promise<BluetoothRemoteGATTService> {
    const device = await navigator.bluetooth.requestDevice({
      filters: [
        {
          services: [this.serviceId],
        },
      ],
    });

    const server = await device.gatt?.connect();
    return server.getPrimaryService(this.serviceId);
  }

  private async initCharacteristics(): Promise<
    Map<string, GATTCharacteristicGateway>
  > {
    const service = await this.serviceP;

    const characteristics = await Promise.all(
      this.characteristicDefs.map(
        async ([id, CharacteristicGateway]): Promise<
          [string, GATTCharacteristicGateway]
        > => {
          const characteristic = await service.getCharacteristic(id);
          return [id, new CharacteristicGateway(characteristic)];
        },
      ),
    );

    return new Map(characteristics);
  }
}

export class DecodedCharacteristicValueChangedEvent<
  T extends BaseDecodedMessage,
> extends CustomEvent<DecodedCharacteristicValueChangedEventDetail<T>> {
  static type = 'decodedcharacteristicvaluechanged';

  constructor(characteristic: BluetoothRemoteGATTCharacteristic, message: T) {
    super(DecodedCharacteristicValueChangedEvent.type, {
      detail: {
        characteristic,
        message,
      },
    });
  }
}

export abstract class GATTCharacteristicGateway extends EventTarget {
  characteristicId: string;
  characteristicLabel: string | undefined;

  characteristic: BluetoothRemoteGATTCharacteristic;

  constructor(
    characteristic: BluetoothRemoteGATTCharacteristic,
    characteristicId: string,
    characteristicLabel: string,
  ) {
    super();
    this.characteristicId = characteristicId;
    this.characteristicLabel = characteristicLabel;
    this.characteristic = characteristic;
  }
}

// export const ReadableMixin = <T extends typeof GATTCharacteristicGateway>(Base: T) => {
//   abstract class ReadableGATTCharacteristicGateway extends Base {
//     abstract parseValue(dataView: DataView): ParsedValue;

//     async getParsedValue(): Promise<ParsedValue> {
//       const dataView = await this.characteristic.readValue();
//       return this.parseValue(dataView);
//     }
//   }

//   return ReadableGATTCharacteristicGateway;
// }

export type GATTCharacteristicGatewayDerived = {
  new (
    characteristic: BluetoothRemoteGATTCharacteristic,
  ): GATTCharacteristicGateway;
};

export abstract class ReadableGATTCharacteristicGateway extends GATTCharacteristicGateway {
  constructor(
    characteristic: BluetoothRemoteGATTCharacteristic,
    characteristicId: string,
    characteristicLabel?: string,
  ) {
    super(characteristic, characteristicId, characteristicLabel);

    this.handleCharacteristicValueChanged =
      this.handleCharacteristicValueChanged.bind(this);
    this.characteristic.addEventListener(
      'characteristicvaluechanged',
      this.handleCharacteristicValueChanged,
    );
  }

  abstract decodeValue(dataView: DataView): BaseDecodedValue;

  async readDecodedValue(): Promise<BaseDecodedValue> {
    const dataView = await this.characteristic.readValue();
    return this.decodeValue(dataView);
  }

  handleCharacteristicValueChanged(evt: CharacteristicValueChangedEvent): void {
    const { timeStamp, target } = evt;
    const dataView: DataView = target.value;
    const parsed = this.decodeValue(dataView);
    this.dispatchEvent(
      new DecodedCharacteristicValueChangedEvent(this.characteristic, {
        type: this.characteristicLabel ?? this.characteristicId,
        timeStamp: double(timeStamp),
        value: parsed,
      }),
    );
  }
}

export abstract class WriteableGATTCharacteristicGateway extends GATTCharacteristicGateway {
  constructor(
    characteristic: BluetoothRemoteGATTCharacteristic,
    characteristicId: string,
    characteristicLabel?: string,
  ) {
    super(characteristic, characteristicId, characteristicLabel);
  }
}

export class DataViewReader {
  dataView: DataView;
  littleEndian: boolean;
  byteIndex: number;

  constructor(dataView: DataView, littleEndian: boolean = false) {
    this.dataView = dataView;
    this.littleEndian = littleEndian;
    this.byteIndex = 0;
  }

  readUint8(): number {
    const value = this.dataView.getUint8(this.byteIndex);
    this.byteIndex += Uint8Array.BYTES_PER_ELEMENT;
    return value;
  }

  readInt16(): number {
    const value = this.dataView.getInt16(this.byteIndex, this.littleEndian);
    this.byteIndex += Int16Array.BYTES_PER_ELEMENT;
    return value;
  }

  readUint16(): number {
    const value = this.dataView.getUint16(this.byteIndex, this.littleEndian);
    this.byteIndex += Uint16Array.BYTES_PER_ELEMENT;
    return value;
  }

  readUint24(): number {
    const value = getUint24(this.dataView, this.byteIndex, this.littleEndian);
    this.byteIndex += 3;
    return value;
  }

  readUint32(): number {
    const value = this.dataView.getUint32(this.byteIndex, this.littleEndian);
    this.byteIndex += Uint32Array.BYTES_PER_ELEMENT;
    return value;
  }
}

export class DataViewWriter {
  dataView: DataView;
  littleEndian: boolean;
  byteIndex: number;

  constructor(maxSize: number, littleEndian: boolean = false) {
    this.dataView = new DataView(new ArrayBuffer(maxSize));
    this.littleEndian = littleEndian;
    this.byteIndex = 0;
  }

  writeUint8(value: number): void {
    this.dataView.setUint8(this.byteIndex, value);
    this.byteIndex += Uint8Array.BYTES_PER_ELEMENT;
  }

  writeInt16(value: number): void {
    this.dataView.setInt16(this.byteIndex, value, this.littleEndian);
    this.byteIndex += Int16Array.BYTES_PER_ELEMENT;
  }

  writeUint16(value: number): void {
    this.dataView.setUint16(this.byteIndex, value, this.littleEndian);
    this.byteIndex += Uint16Array.BYTES_PER_ELEMENT;
  }

  // writeUint24(value: number): void {
  //   setUint24(this.dataView, this.byteIndex, value, this.littleEndian);
  //   this.byteIndex += 3;
  // }

  writeUint32(value: number): void {
    this.dataView.setUint32(this.byteIndex, value, this.littleEndian);
    this.byteIndex += Uint32Array.BYTES_PER_ELEMENT;
  }

  getClampedDataView(): DataView {
    return new DataView(this.dataView.buffer, 0, this.byteIndex);
  }
}
