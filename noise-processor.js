/**
 * AudioWorklet Processor for procedural noise generation
 * Generates endless, non-repeating noise using mathematical algorithms
 */

class NoiseProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    // Current noise type
    this.noiseType = 'white';

    // Pink noise state (Voss-McCartney algorithm)
    this.pinkRows = new Float32Array(16);
    this.pinkRunningSum = 0;
    this.pinkIndex = 0;
    this.pinkIndexMask = (1 << 16) - 1;

    // Brown noise state
    this.brownLast = 0;

    // Blue/Violet noise state
    this.blueLast = 0;
    this.violetLast = [0, 0];

    // Handle messages from main thread
    this.port.onmessage = (event) => {
      if (event.data.type === 'setNoiseType') {
        this.noiseType = event.data.noiseType;
      }
    };
  }

  /**
   * Generate white noise sample (uniform random distribution)
   */
  white() {
    return Math.random() * 2 - 1;
  }

  /**
   * Generate pink noise using Voss-McCartney algorithm
   * Pink noise has equal energy per octave (1/f spectrum)
   */
  pink() {
    const white = this.white();

    // Voss-McCartney algorithm
    this.pinkIndex = (this.pinkIndex + 1) & this.pinkIndexMask;

    // Calculate how many rows need to change
    let numZeros = 0;
    let n = this.pinkIndex;
    while ((n & 1) === 0 && numZeros < 16) {
      numZeros++;
      n >>= 1;
    }

    // Update the running sum with changed rows
    if (numZeros < 16) {
      this.pinkRunningSum -= this.pinkRows[numZeros];
      const newValue = white;
      this.pinkRunningSum += newValue;
      this.pinkRows[numZeros] = newValue;
    }

    // Add white noise for high frequencies and normalize
    return (this.pinkRunningSum + white) / 17;
  }

  /**
   * Generate brown (Brownian/red) noise
   * Brown noise is integrated white noise, emphasizing low frequencies
   */
  brown() {
    const white = this.white();
    // Leaky integration to prevent DC drift
    this.brownLast = (this.brownLast + (0.02 * white)) / 1.02;
    // Normalize output
    return this.brownLast * 3.5;
  }

  /**
   * Generate blue noise
   * Blue noise has increasing power with frequency (+3dB/octave)
   */
  blue() {
    const white = this.white();
    // Simple differentiation (high-pass)
    const blue = white - this.blueLast;
    this.blueLast = white;
    return blue * 0.7;
  }

  /**
   * Generate violet noise
   * Violet noise has even stronger high frequency emphasis (+6dB/octave)
   */
  violet() {
    const white = this.white();
    // Second-order differentiation
    const diff1 = white - this.violetLast[0];
    const diff2 = diff1 - this.violetLast[1];
    this.violetLast[0] = white;
    this.violetLast[1] = diff1;
    return diff2 * 0.5;
  }

  /**
   * Get a noise sample based on current type
   */
  getSample() {
    switch (this.noiseType) {
      case 'pink':
        return this.pink();
      case 'brown':
        return this.brown();
      case 'blue':
        return this.blue();
      case 'violet':
        return this.violet();
      case 'white':
      default:
        return this.white();
    }
  }

  /**
   * Process audio - called for each block of samples
   */
  process(inputs, outputs, parameters) {
    const output = outputs[0];

    // Fill all output channels with the same noise
    for (let channel = 0; channel < output.length; channel++) {
      const outputChannel = output[channel];
      for (let i = 0; i < outputChannel.length; i++) {
        // Generate unique sample per channel position for stereo width
        // but same base algorithm
        outputChannel[i] = this.getSample();
      }
    }

    // Return true to keep processor alive
    return true;
  }
}

registerProcessor('noise-processor', NoiseProcessor);
