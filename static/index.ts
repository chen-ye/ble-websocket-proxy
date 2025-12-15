import { cborDecoder, cborEncoder } from './cbor.js';
import { HRSGateway, HRMMessage } from './ble/hrs.js';
import { CyclingPowerServiceGateway, PowerMessage } from './ble/power.js';
import { DecodedCharacteristicValueChangedEvent } from './ble/common.js';
import { FTMSServiceGateway, IndoorBikeDataMessage } from './ble/ftms.js';
import { SteeringServiceGateway, SteeringDataMessage } from './ble/sterzo.js';

const handleHRNotify = (
  evt: DecodedCharacteristicValueChangedEvent<HRMMessage>,
) => {
  const { characteristic, message } = evt.detail;

  const dataView: DataView = characteristic.value;
  if (dataView && rawHRMWs.readyState === WebSocket.OPEN) {
    if (rawHRMWs.readyState === WebSocket.OPEN) {
      rawHRMWs.send(dataView);
    }
  }

  console.info(message, Date.now());
  if ($hrmFeedback) {
    $hrmFeedback.value = message.value.heartRateValue.toString(10);
  }
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(cborEncoder.encode(message));
  }
};

const handlePowerNotify = (
  evt: DecodedCharacteristicValueChangedEvent<PowerMessage>,
) => {
  const { characteristic, message } = evt.detail;

  const dataView: DataView = characteristic.value;
  if (dataView && rawPowerWs.readyState === WebSocket.OPEN) {
    if (rawPowerWs.readyState === WebSocket.OPEN) {
      rawPowerWs.send(dataView);
    }
  }

  console.info(message, Date.now());
  if ($powerFeedback) {
    $powerFeedback.value = message.value.instantaneousPower.toString(10);
  }
  if (
    $powerCadenceFeedback &&
    message.value.numCompleteCrankRevolutions !== undefined
  ) {
    $powerCadenceFeedback.value =
      message.value.numCompleteCrankRevolutions.toString(10);
  }
  ws.send(cborEncoder.encode(message));
};

const handleFTMSNotify = (
  evt: DecodedCharacteristicValueChangedEvent<IndoorBikeDataMessage>,
) => {
  const { message } = evt.detail;

  console.info(message, Date.now());
  if ($ftmsPowerFeedback) {
    $ftmsPowerFeedback.value = message.value.instantaneousPower?.toString(10);
  }
  if ($ftmsSpeedFeedback) {
    $ftmsSpeedFeedback.value = message.value.instantaneousSpeed?.toString(10);
  }
  if ($ftmsCadenceFeedback) {
    $ftmsCadenceFeedback.value =
      message.value.instantaneousCadence?.toString(10);
  }
  // console.log(decode(cborEncoder.encode(message)));
  ws.send(cborEncoder.encode(message));
};

const handleSteeringNotify = (
  evt: DecodedCharacteristicValueChangedEvent<SteeringDataMessage>,
) => {
  const { message } = evt.detail;

  console.info(message, Date.now());
  if ($steeringFeedback) {
    $steeringFeedback.value = message.value.angle?.toFixed(0);
  }

  ws.send(cborEncoder.encode(message));
};

const $startHRM = document.querySelector('#start-hrm');
const $hrmFeedback = document.querySelector<HTMLInputElement>('#hrm-feedback');

$startHRM?.addEventListener('click', async () => {
  const serviceGateway = new HRSGateway();
  const characteristicGateway = await serviceGateway.heartRateMeasurementP;

  characteristicGateway.characteristic.startNotifications();
  characteristicGateway.addEventListener(
    DecodedCharacteristicValueChangedEvent.type,
    handleHRNotify,
  );
});

const $startPower = document.querySelector('#start-power');
const $powerFeedback =
  document.querySelector<HTMLInputElement>('#power-feedback');
const $powerCadenceFeedback = document.querySelector<HTMLInputElement>(
  '#power-cadence-feedback',
);

$startPower?.addEventListener('click', async () => {
  const serviceGateway = new CyclingPowerServiceGateway();
  const characteristicGateway = await serviceGateway.cyclingPowerMeasurementP;

  characteristicGateway.addEventListener(
    DecodedCharacteristicValueChangedEvent.type,
    handlePowerNotify,
  );
  characteristicGateway.characteristic.startNotifications();
});

const $startFTMS = document.querySelector('#start-ftms');
const $ftmsPowerFeedback = document.querySelector<HTMLInputElement>(
  '#ftms-power-feedback',
);
const $ftmsCadenceFeedback = document.querySelector<HTMLInputElement>(
  '#ftms-cadence-feedback',
);
const $ftmsSpeedFeedback = document.querySelector<HTMLInputElement>(
  '#ftms-speed-feedback',
);

$startFTMS?.addEventListener('click', async () => {
  const serviceGateway = new FTMSServiceGateway();
  const indoorBikeData = await serviceGateway.indoorBikeDataP;
  const fitnessMachineControlPoint =
    await serviceGateway.fitnessMachineControlPointP;

  await fitnessMachineControlPoint.requestControl();

  indoorBikeData.addEventListener(
    DecodedCharacteristicValueChangedEvent.type,
    handleFTMSNotify,
  );
  indoorBikeData.characteristic.startNotifications();

  const controlPoint = await serviceGateway.fitnessMachineControlPointP;
  await controlPoint.requestControl();

  ws.addEventListener('message', async (evt) => {
    const blob: Blob = evt.data;
    const arrayBuffer = await blob.arrayBuffer();
    const message = cborDecoder.decode(new Uint8Array(arrayBuffer));
    if (message.type === 'indoor_bike_simulation') {
      fitnessMachineControlPoint.setIndoorBikeSimulationParameters(
        message.value,
      );
    }
  });
});

const $startSteering = document.querySelector('#start-steering');
const $steeringFeedback =
  document.querySelector<HTMLInputElement>('#steering-feedback');

$startSteering?.addEventListener('click', async () => {
  const serviceGateway = new SteeringServiceGateway();
  const steeringData = await serviceGateway.steeringDataP;
  steeringData.addEventListener(
    DecodedCharacteristicValueChangedEvent.type,
    handleSteeringNotify,
  );
  steeringData.characteristic.startNotifications();
});

const websocketURL = new URL('/ws/ble/', import.meta.url);
websocketURL.protocol = 'ws';
websocketURL.port = `${8000}`;

const rawWebsocketURLBase = new URL('raw/', websocketURL);

const ws = new WebSocket(websocketURL);
ws.addEventListener('open', () => {
  console.log('socket opened');
});

const rawHRMWs = new WebSocket(new URL('hrm', rawWebsocketURLBase));
rawHRMWs.addEventListener('open', () => {
  console.log('raw socket opened');
});

const rawPowerWs = new WebSocket(new URL('power', rawWebsocketURLBase));
rawPowerWs.addEventListener('open', () => {
  console.log('raw socket opened');
});
