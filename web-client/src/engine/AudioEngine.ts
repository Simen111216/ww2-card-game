export class AudioEngine {
  private static ctx: AudioContext | null = null;

  private static getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public static playAttackSound(isArtillery: boolean = false, isAir: boolean = false) {
    const ctx = this.getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (isArtillery) {
      // 炮击声 (低频轰鸣)
      osc.type = 'square';
      osc.frequency.setValueAtTime(100, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(20, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } else if (isAir) {
      // 空袭声 (高频俯冲)
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.6);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    } else {
      // 普通开火声 (白噪声模拟)
      const bufferSize = ctx.sampleRate * 0.1;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.value = 1000;
      noise.connect(noiseFilter);
      noiseFilter.connect(gain);
      
      gain.gain.setValueAtTime(1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      
      noise.start();
    }
  }

  public static playDamageSound() {
    const ctx = this.getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.2);
    
    gain.gain.setValueAtTime(0.8, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  }

  public static playDeathSound() {
    const ctx = this.getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(10, ctx.currentTime + 0.5);
    
    gain.gain.setValueAtTime(1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  }

  public static playRadioSound() {
    const ctx = this.getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.setValueAtTime(0.1, ctx.currentTime + 0.05);
    gain.gain.setValueAtTime(0, ctx.currentTime + 0.06);
    gain.gain.setValueAtTime(0.1, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0, ctx.currentTime + 0.15);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  }
}