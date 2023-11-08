import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, TextInput, Button, StyleSheet, Picker, Platform } from 'react-native';
// Assuming the library provides a way to get available MIDI devices and send messages
// MIDI
import { MIDIMessageEvent, requestMIDIAccess } from '@motiz88/react-native-midi';


// ===========================
//        Utils
// ===========================

const verbose = false;

const isMIDIInputConnected = (MIDIInput: MIDIInput) => (MIDIInput && MIDIInput.connected);

const getMIDIDeviceInfo = (MIDIInput: MIDIInput) => ((Platform.OS === 'web') ? MIDIInput : MIDIInput?.deviceInfo);

const getMIDIDeviceName = (MIDIInput: MIDIInput) => ((Platform.OS === 'web') ? getMIDIDeviceInfo(MIDIInput)?.name : getMIDIDeviceInfo(MIDIInput)?.properties?.name);

const MIDIIsATravelSax = (MIDIInput: MIDIInput) => (getMIDIDeviceName(MIDIInput)?.search('TravelSax2') !== -1);

const instrumentMidiList = [
  {
    name: 'Tenor',
    MIDINumber: 128
  },
  {
    name: 'Alto',
    MIDINumber: 129
  },
  {
    name: 'Soprano',
    MIDINumber: 130
  },
  {
    name: 'Piano',
    MIDINumber: 0,
  },
  {
    name: 'Bajo',
    MIDINumber: 32,
  },
  {
    name: 'Harmonica',
    MIDINumber: 22,
  },
  {
    name: 'violin',
    MIDINumber: 40,
  },
  {
    name: 'viola',
    MIDINumber: 41,
  },
  {
    name: 'cello',
    MIDINumber: 42,
  },
  {
    name: 'trumpet',
    MIDINumber: 56,
  },
  {
    name: 'trombon',
    MIDINumber: 57,
  },
  {
    name: 'tuba',
    MIDINumber: 58,
  },
  {
    name: 'bajo synth',
    MIDINumber: 63,
  },
  {
    name: 'clarinet',
    MIDINumber: 71,
  },
  {
    name: 'Ocarina',
    MIDINumber: 79,
  },
  {
    name: 'Pad Choir',
    MIDINumber: 91,
  },
  // else if (instrument >= 32 && instrument <= 39) // bass
  // else if (instrument >= 73 && instrument <= 78) // Flautes
]


// ===========================
//        APP
// ===========================

const App = () => {
  const [msb, setMsb] = useState('');
  const [lsb, setLsb] = useState('');
  const [nrpnValue, setNrpnValue] = useState('');
  const [reverbValue, setReverbValue] = useState('');
  const [instrumentMIDINumber, setInstrumentMIDINumber] = useState<number>(null);
  const [customInstrumentValue, setCustomInstrumentValue] = useState<string>(null);

  // ===========================
  //        MIDI Handling
  // ===========================

  // MIDI State
  const MIDIAccessRef = useRef<MIDIAccess>(null);
  const aMIDIDeviceIsConnected = useRef(false);
  const [MIDIInputPeripherals, setMIDIInputPeripherals] = useState(new Map());
  const [MIDIOutputPeripherals, setMIDIOutputPeripherals] = useState(new Map());
  const [connectError, setConnectError] = useState<string>('');
  const [selectedInputDeviceId, setSelectedInputDeviceId] = useState<string>('-271543291');
  const [selectedOutputDeviceId, setSelectedOutputDeviceId] = useState<string>('-1318638608');

  const getSelectedDevice = (type: 'input' | 'output') => (type === 'input') ? MIDIInputPeripherals.get(selectedInputDeviceId) : MIDIOutputPeripherals.get(selectedOutputDeviceId);

  // Update peripherals from list
  const updateMIDIInputPeripherals = useCallback((key: string, value: MIDIInput) => {
    setMIDIInputPeripherals(new Map(MIDIInputPeripherals.set(key, value)));
  }, [MIDIInputPeripherals]);
  const updateMIDIOutputPeripherals = useCallback((key: string, value: MIDIOutput) => {
    setMIDIOutputPeripherals(new Map(MIDIOutputPeripherals.set(key, value)));
  }, [MIDIOutputPeripherals]);

  const resetMIDIInputPeripherals = () => setMIDIInputPeripherals(new Map());

  // Remove all the onmidimessage for the last stored MIDIAccessRef
  const resetInputs = () => {
    if (MIDIAccessRef.current) {
      MIDIAccessRef.current.inputs.forEach((MIDIInput) => {
        verbose && console.log('Removing onmidimessage for: ', getMIDIDeviceName(MIDIInput));
        MIDIInput.onmidimessage = null;
      });
    }
  };

  const iterateOnMIDIDevices = useCallback(async (type: 'inputs' | 'outputs', actionCb: (MIDIDevice: MIDIInput | MIDIOutput) => void) => {
    // We start by resetting all previous inputs
    resetInputs();

    await requestMIDIAccess().then((tempMIDIAccess) => {
      console.log('MIDIAccess found with inputs: ', tempMIDIAccess.inputs, ' and outputs: ', tempMIDIAccess.outputs);

      // Storing the last fetched MIDIAccess
      MIDIAccessRef.current = tempMIDIAccess;

      if (tempMIDIAccess[type].size === 0) {
        return console.error('No MIDI devices found.', tempMIDIAccess.inputs, tempMIDIAccess);
      }

      tempMIDIAccess[type].forEach(actionCb);
    });

    if (MIDIInputPeripherals.size === 0) {
      setConnectError('No MIDI devices found. Tap to search again.');
    }
  }, [MIDIInputPeripherals]);

  const handleMIDIMessage = (event: MIDIMessageEvent) => {
    const command = event.data[0]; // A command value of 144 signifies a “note on” event, and 128 typically signifies a “note off” event.
    const param1 = event.data[1];
    const param2 = event.data[2];
    verbose && console.log(`MIDI Received. Command: ${command} with param 1: ${param1} and param 2: ${param2}.`, event);

    // Only triggering Channel 1 for all Sounds but the saxos
    if (getSelectedDevice('output') && instrumentMIDINumber< 127) sendMIDIMessage([command, param1, param2]);

    switch (command) {
      case 144: // noteOn, <v3
      case 151: // noteOn, >v3.0.3
        // param1: Note MIDI number is shared. MIDI note values range from 0 to 127, lowest to highest.
        //         For example, the lowest note on an 88-key piano has a value of 21, and the highest note is 108.
        //         The Alto Saxophone goes from 46 (Bb2) to 80 (G#5). A “middle C” is 60.
        // param2: Velocity (useless, always 0)

        verbose && console.log('noteOn : ', param1, param2);

        if (getSelectedDevice('output') && instrumentMIDINumber > 127) {
          for (let i = 0; i < 5; i += 1) {
            sendMIDIMessage([0x90 + i, param1, param2]);
          }
        }

        // Trigger parent noteOff event function
        break;
      case 128: // noteOff, <v3
      case 135: // noteOn, >v3.0.3
      // See noteOn comments for details.
        verbose && console.log('noteOff : ', param1, param2);

        if (getSelectedDevice('output') && instrumentMIDINumber > 127) {
          for (let i = 0; i < 5; i += 1) {
            sendMIDIMessage([0x80 + i, param1, param2]);
          }
        }
        break;
      case 176: // Misc info, all <v3 & only keys >v3
      case 183: // Velocity, >v3
        // param1: define the info type (key pressed, velocity...)

        if (param1 === 14) { // Key pressed
          // param2: index of the note pressed
          verbose && console.log('Key pressed : ', param1, param2);
        } else if (param1 === 15) { // Key released
          // param2: index of the note pressed
          verbose && console.log('Key released : ', param1, param2);
        } else if (param1 === 7) { // Velocity (disabled)
          // We forward the volume data to the output device is set
          if (getSelectedDevice('output') && instrumentMIDINumber > 127) {
            for (let i = 0; i < 5; i += 1) {
              sendMIDIMessage([0xB0 + i, param1, param2]);
            }
          }
          // console.log('Velocity: ', event.data[2]);
          // Do not keep track of velocity on Android for perf. reason
          // if (isOpen && Platform.OS !== 'android') {
          //   setCurrentVelocity((event.data.length > 2) ? event.data[2] : 0);
          // }
        }
        break;
      // we could easily expand this switch statement to cover other types of commands such as controllers or sysex
      default:
        console.error(`Command code not found: ${command} with param 1: ${param1} and param 2: ${param2}.`);
        break;
    }
  };

  const connectMIDIPeripheral = useCallback((MIDIInput: MIDIInput) => {
    // Set the onmidimessage value
    MIDIInput.onmidimessage = handleMIDIMessage;

    // TravelSax now connected !
    // Update the idOfConnectedMIDIDevice state value
    MIDIInput.connected = true;
    aMIDIDeviceIsConnected.current = true;
    updateMIDIInputPeripherals(getMIDIDeviceInfo(MIDIInput).id, MIDIInput);
  }, [handleMIDIMessage, updateMIDIInputPeripherals]);

  const findMIDIDevices = () => {
    console.log('MIDI Device search started');

    // First reset the MIDI peripherals list
    resetMIDIInputPeripherals();

    // Then search through the MIDI inputs
    iterateOnMIDIDevices('inputs', (MIDIInput: MIDIInput) => {
      console.log('MIDI Input found: ', MIDIInput);
      if (MIDIInput
      && ((Platform.OS !== 'web' && MIDIInput.deviceInfo) || (Platform.OS === 'web'))) {
        const deviceInfo = getMIDIDeviceInfo(MIDIInput);

        if (selectedInputDeviceId === deviceInfo.id) {
          console.log('Selected input device found:', selectedInputDeviceId, deviceInfo.id);
          connectMIDIPeripheral(MIDIInput);
        }

        // We add an MIDI Input when we found one
        // console.log('Adding MIDIInput', MIDIInput);
        updateMIDIInputPeripherals(deviceInfo.id, MIDIInput);
      } else {
        console.log('MIDI Device not valid: ', MIDIInput);
      }
    });

    // Then search through the MIDI inputs
    iterateOnMIDIDevices('outputs', (MIDIOutput: MIDIOutput) => {
      console.log('MIDI Output found: ', MIDIOutput);
      if (MIDIOutput
      && ((Platform.OS !== 'web' && MIDIOutput.deviceInfo) || (Platform.OS === 'web'))) {
        const deviceInfo = getMIDIDeviceInfo(MIDIOutput);

        // We add an MIDI Input when we found one
        // console.log('Adding MIDIInput', MIDIInput);
        updateMIDIOutputPeripherals(deviceInfo.id, MIDIOutput);
      } else {
        console.error('MIDI Device not valid: ', MIDIOutput);
      }
    });
  };

  // MIDIData: [command: number, param1: number, param2: number]
  const sendMIDIMessage = async (MIDIData: [number, number, number]) => {
    if (!selectedOutputDeviceId) {
      alert('Please select a MIDI device');
      return;
    }

    try {
      // Send MIDI message
      console.log('MIDI Message sent: ', MIDIData);
      await getSelectedDevice('output').send(MIDIData)
    } catch (error) {
      console.error('Error sending MIDI message: ', error);
    }
  };

  const sendControlChange = async (channel: number, control: number, value: number) => {
    if (!selectedOutputDeviceId) {
      alert('Please select a MIDI device');
      return;
    }

    const MIDIData:[number, number, number] = [0xB0 + channel, control, value];
    console.log(`MIDI CC Message sent:
    Channel: ${channel}
    Control: ${control}
    Value: ${value}`, MIDIData);
    sendMIDIMessage(MIDIData);
  };

  const sendProgramChange = async (channel: number, value: number) => {
    if (!selectedOutputDeviceId) {
      alert('Please select a MIDI device');
      return;
    }


    const MIDIData:[number, number, number] = [0xC0 + channel, value, 0xFF];
    console.log(`MIDI Program Change sent:
    Channel: ${channel}
    Value: ${value}`, MIDIData);
    sendMIDIMessage(MIDIData);
  };

  const updateInstrument = async (customInstrument: number | null = null) => {
    if (customInstrument === null && instrumentMIDINumber === null) {
      alert('Please select an instrument');
      return;
    }

    const finalInstrumentMIDINumber = (customInstrument === null) ? instrumentMIDINumber : customInstrument;

    if (finalInstrumentMIDINumber > 127) {
      // Iterate over the 4 layers of intrument
      for (let i = 0; i < 5; i += 1) {
        sendControlChange(i, 0, 10);
        sendProgramChange(i, i + 5 * (finalInstrumentMIDINumber - 128));
      }
    } else {
      sendControlChange(0, 0, 0);
      sendProgramChange(0, finalInstrumentMIDINumber);
    }
  };

  const sendNRPN = async (msbValue:number, lsbValue: number, value: number) => {
    if (!selectedOutputDeviceId) {
      alert('Please select a MIDI device');
      return;
    }
    if (msbValue === null || msbValue === undefined || value  === null || value === undefined ) {
      alert('Invalid MSB and Value for NRPN message');
      console.error('Invalid MSB and Value for NRPN message', msbValue, lsbValue, value);
      return;
    }

    // Send NRPN message
    await sendControlChange(0, 0x63, msbValue); // 0x63 = 99 , other first param option: 0xB0,
    if (lsbValue) await sendControlChange(0, 0x62, lsbValue); // 0x62 = 98
    await sendControlChange(0, 0x06, value);
  };

  // ===========================
  //        useEffects
  // ===========================

  useEffect(() => {
    // Load available MIDI devices
    findMIDIDevices();
  }, []);

  useEffect(() => {
    if (selectedInputDeviceId !== null && getSelectedDevice('input')) {
      console.log('Selected input device:', selectedInputDeviceId, getSelectedDevice('input'));
      connectMIDIPeripheral(getSelectedDevice('input'));
    }
  }, [selectedInputDeviceId]);

  useEffect(() => {
    if (selectedOutputDeviceId !== null && getSelectedDevice('output')) {
      console.log('Selected output device:', selectedOutputDeviceId, getSelectedDevice('output'));
    }
  }, [selectedOutputDeviceId]);

  useEffect(() => {
    if (instrumentMIDINumber !== null) {
      console.log('Selected instrument:', instrumentMIDINumber);
      updateInstrument();
    }
  }, [instrumentMIDINumber]);

  return (
    <View style={styles.container}>
      {/* Input Device Picker */}
      <Text style={styles.header}>Input Device</Text>
      <Picker
        selectedValue={selectedInputDeviceId}
        style={styles.picker}
        onValueChange={(itemValue: string) => setSelectedInputDeviceId(itemValue) }
      >
        <Picker.Item key={-1} label={'No input device selected'} value={null} />
        {Array.from(MIDIInputPeripherals.values()).map((device, index) => (
          <Picker.Item key={index} label={device.name} value={device.id} />
        ))}
      </Picker>
      
      {/* Output Device Picker */}
      <Text style={styles.header}>Output Device</Text>
      <Picker
        selectedValue={selectedOutputDeviceId}
        style={styles.picker}
        onValueChange={(itemValue: string) => setSelectedOutputDeviceId(itemValue) }
      >
        <Picker.Item key={-1} label={'No output device selected'} value={null} />
        {Array.from(MIDIOutputPeripherals.values()).map((device, index) => (
          <Picker.Item key={index} label={device.name} value={device.id} />
        ))}
      </Picker>

      {/* Instrument Picker */}
      <Text style={styles.header}>Instrument Type</Text>
      <Picker
        selectedValue={instrumentMIDINumber}
        style={styles.picker}
        onValueChange={(itemValue: string) => setInstrumentMIDINumber(parseInt(itemValue, 10)) }
      >
        <Picker.Item key={-1} label={'No instrument selected'} value={null} />
        {instrumentMidiList.map((device, index) => (
          <Picker.Item key={index} label={`${device.name} (MIDI Number: ${device.MIDINumber})`} value={device.MIDINumber} />
        ))}
      </Picker>

      {/* Custom Instrument */}
      <Text style={styles.header}>Custom Instrument</Text>
      <TextInput
        style={styles.input}
        placeholder="Value (0-127)"
        value={customInstrumentValue}
        onChangeText={setCustomInstrumentValue}
        keyboardType="numeric"
      />
      <Button title="Update Instrument" onPress={() => updateInstrument(parseInt(customInstrumentValue, 10))} />

      {/* Reverb Value */}
      <Text style={styles.header}>Reverb Amount</Text>
      <TextInput
        style={styles.input}
        placeholder="Value (0-127)"
        value={reverbValue}
        onChangeText={setReverbValue}
        keyboardType="numeric"
      />
      <Button title="Update Reverb" onPress={() => sendNRPN(0x37, 0x58, parseInt(reverbValue, 10))} />

      {/* NRPN Input */}
      <Text style={styles.header}>NRPN Custom Values</Text>
      <TextInput
        style={styles.input}
        placeholder="MSB (0-127)"
        value={msb}
        onChangeText={setMsb}
        keyboardType="numeric"
      />
      <TextInput
        style={styles.input}
        placeholder="LSB (0-127)"
        value={lsb}
        onChangeText={setLsb}
        keyboardType="numeric"
      />
      <TextInput
        style={styles.input}
        placeholder="Value (0-127)"
        value={nrpnValue}
        onChangeText={setNrpnValue}
        keyboardType="numeric"
      />
      <Button title="Send NRPN Message" onPress={() => sendNRPN(parseInt(msb, 10), parseInt(lsb, 10), parseInt(nrpnValue, 10))} />

      {/* NRPN Input */}
      <Text style={styles.header}>MIDI Message</Text>
      <TextInput
        style={styles.input}
        placeholder="MSB (0-127)"
        value={msb}
        onChangeText={setMsb}
        keyboardType="numeric"
      />
      <TextInput
        style={styles.input}
        placeholder="LSB (0-127)"
        value={lsb}
        onChangeText={setLsb}
        keyboardType="numeric"
      />
      <TextInput
        style={styles.input}
        placeholder="Value (0-127)"
        value={nrpnValue}
        onChangeText={setNrpnValue}
        keyboardType="numeric"
      />
      <Button title="Send NRPN Message" onPress={() => sendNRPN(parseInt(msb, 10), parseInt(lsb, 10), parseInt(nrpnValue, 10))} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    display: 'flex',
    width: '100%',
    textAlign: 'left',
    fontWeight: 'bold',
    fontSize: 18,
    marginTop: 30,
    marginBottom: 10,
  },
  picker: {
    width: '100%',
    height: 50,
  },
  input: {
    width: '100%',
    borderWidth: 1,
    padding: 10,
    marginVertical: 5,
  },
});

export default App;
