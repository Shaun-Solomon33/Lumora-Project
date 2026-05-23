import React, { useState } from 'react';
import { HeartPulse, Droplets, Waves, Activity, Flame, Sun, ShieldAlert, ChevronRight, ArrowLeft } from 'lucide-react';

const GUIDES = [
  {
    id: 'cpr',
    title: 'CPR (Cardiopulmonary Resuscitation)',
    icon: HeartPulse,
    color: 'text-[#ff3b3b]',
    bgColor: 'bg-[#ff3b3b]/10',
    borderColor: 'border-[#ff3b3b]/30',
    steps: [
      'Check the scene for safety, then check the person for responsiveness.',
      'Call 112 or your local emergency number immediately.',
      'Place the heel of one hand on the center of the chest, and the other hand on top.',
      'Push hard and fast: at least 2 inches deep and 100-120 pushes a minute.',
      'Allow the chest to return to its normal position after each push.',
      'Continue compressions until help arrives or the person shows signs of life.'
    ]
  },
  {
    id: 'bleeding',
    title: 'Severe Bleeding',
    icon: Droplets,
    color: 'text-[#ff3b3b]',
    bgColor: 'bg-[#ff3b3b]/10',
    borderColor: 'border-[#ff3b3b]/30',
    steps: [
      'Find the source of the bleeding.',
      'Cover the wound with a clean cloth or sterile dressing.',
      'Apply direct, continuous pressure with both hands.',
      'If bleeding does not stop, apply a tourniquet 2-3 inches above the wound (not on a joint).',
      'Tighten the tourniquet until the bleeding stops.',
      'Note the exact time the tourniquet was applied and wait for emergency responders.'
    ]
  },
  {
    id: 'flood',
    title: 'Flood Survival',
    icon: Waves,
    color: 'text-[#00d4ff]',
    bgColor: 'bg-[#00d4ff]/10',
    borderColor: 'border-[#00d4ff]/30',
    steps: [
      'Move immediately to higher ground or a higher floor.',
      'Do not walk, swim, or drive through floodwaters. Turn Around, Don\'t Drown!',
      'Stay off bridges over fast-moving water.',
      'If your vehicle is trapped in rapidly moving water, stay inside. If water is rising inside, seek refuge on the roof.',
      'If trapped in a building, go to its highest level. Do not climb into a closed attic.'
    ]
  },
  {
    id: 'earthquake',
    title: 'Earthquake Response',
    icon: Activity,
    color: 'text-[#ffeb3b]',
    bgColor: 'bg-[#ffeb3b]/10',
    borderColor: 'border-[#ffeb3b]/30',
    steps: [
      'DROP to your hands and knees immediately.',
      'COVER your head and neck with your arms. Crawl under a sturdy table or desk if nearby.',
      'HOLD ON to your shelter until the shaking stops.',
      'If outdoors, move away from buildings, streetlights, and utility wires.',
      'If in a vehicle, stop as quickly and safely as possible and stay in the vehicle.',
      'Be prepared for aftershocks.'
    ]
  },
  {
    id: 'fire',
    title: 'Fire Escape',
    icon: Flame,
    color: 'text-[#ff9800]',
    bgColor: 'bg-[#ff9800]/10',
    borderColor: 'border-[#ff9800]/30',
    steps: [
      'Get low and go under the smoke to your exit.',
      'Feel doors before opening them. If the door is hot, do not open it. Find another way out.',
      'If your clothes catch fire: STOP, DROP, and ROLL.',
      'Once outside, stay outside. Never go back inside a burning building.',
      'Call 112 from a safe location.'
    ]
  },
  {
    id: 'heat',
    title: 'Heat Stroke',
    icon: Sun,
    color: 'text-[#ff9800]',
    bgColor: 'bg-[#ff9800]/10',
    borderColor: 'border-[#ff9800]/30',
    steps: [
      'Call 112 immediately. Heat stroke is a medical emergency.',
      'Move the person to a cooler place (shade or air-conditioned room).',
      'Help lower the person\'s body temperature with cool cloths or a cool bath.',
      'Do NOT give the person anything to drink if they are losing consciousness.',
      'Stay with the person until emergency medical services arrive.'
    ]
  },
  {
    id: 'snake',
    title: 'Snake Bite',
    icon: ShieldAlert,
    color: 'text-[#4ade80]',
    bgColor: 'bg-[#4ade80]/10',
    borderColor: 'border-[#4ade80]/30',
    steps: [
      'Call 112 immediately.',
      'Keep the person calm and still to slow the spread of venom.',
      'Position the bitten area at or below the level of the heart.',
      'Remove any tight clothing or jewelry near the bite.',
      'Do NOT cut the wound or attempt to suck out the venom.',
      'Do NOT apply a tourniquet or ice.'
    ]
  }
];

export default function SurvivalVaultScreen() {
  const [selectedGuide, setSelectedGuide] = useState<string | null>(null);

  const activeGuide = GUIDES.find(g => g.id === selectedGuide);

  if (activeGuide) {
    const Icon = activeGuide.icon;
    return (
      <main className="flex-1 w-full flex flex-col bg-[#0a0f1e] animate-in fade-in duration-500 overflow-y-auto pb-24">
        <header className="bg-[#0a0f1e]/90 backdrop-blur-xl border-b border-white/10 sticky top-0 z-40">
          <div className="p-4 flex items-center gap-3">
            <button 
              onClick={() => setSelectedGuide(null)}
              className="p-2 -ml-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors"
            >
              <ArrowLeft size={24} />
            </button>
            <div className={`w-10 h-10 rounded-full ${activeGuide.bgColor} border ${activeGuide.borderColor} flex items-center justify-center`}>
              <Icon className={activeGuide.color} size={20} />
            </div>
            <div>
              <h1 className="text-white font-bold tracking-widest text-sm uppercase">
                {activeGuide.title}
              </h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="w-2 h-2 rounded-full bg-[#4ade80]"></div>
                <span className="text-[#4ade80] text-[10px] uppercase tracking-widest font-bold">Offline Guide</span>
              </div>
            </div>
          </div>
        </header>

        <div className="p-4 space-y-4">
          {activeGuide.steps.map((step, index) => (
            <div key={index} className="bg-white/5 border border-white/10 rounded-2xl p-5 flex gap-4">
              <div className={`shrink-0 w-8 h-8 rounded-full ${activeGuide.bgColor} border ${activeGuide.borderColor} flex items-center justify-center font-mono font-bold ${activeGuide.color}`}>
                {index + 1}
              </div>
              <p className="text-white/90 text-lg leading-relaxed pt-0.5">
                {step}
              </p>
            </div>
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 w-full flex flex-col bg-[#0a0f1e] animate-in fade-in duration-500 overflow-y-auto pb-24">
      <header className="bg-[#0a0f1e]/90 backdrop-blur-xl border-b border-white/10 sticky top-0 z-40">
        <div className="p-4 flex items-center justify-between">
          <div>
            <h1 className="text-white font-bold tracking-widest text-sm flex items-center gap-2">
              SURVIVAL VAULT
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-2 h-2 rounded-full bg-[#4ade80]"></div>
              <span className="text-[#4ade80] text-[10px] uppercase tracking-widest font-bold">Works Offline</span>
            </div>
          </div>
        </div>
      </header>

      <div className="p-4">
        <p className="text-white/60 text-sm mb-6">
          These guides are stored locally on your device and will work even without an internet connection.
        </p>

        <div className="space-y-3">
          {GUIDES.map(guide => {
            const Icon = guide.icon;
            return (
              <button
                key={guide.id}
                onClick={() => setSelectedGuide(guide.id)}
                className="w-full bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-4 flex items-center gap-4 transition-colors text-left"
              >
                <div className={`shrink-0 w-12 h-12 rounded-full ${guide.bgColor} border ${guide.borderColor} flex items-center justify-center`}>
                  <Icon className={guide.color} size={24} />
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-bold text-lg">{guide.title}</h3>
                  <p className="text-white/50 text-xs uppercase tracking-widest mt-1">Tap to view steps</p>
                </div>
                <ChevronRight className="text-white/30 shrink-0" size={24} />
              </button>
            );
          })}
        </div>
      </div>
    </main>
  );
}
