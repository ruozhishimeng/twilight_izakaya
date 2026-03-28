import React, { useState, useEffect, useMemo } from 'react';
import StartScreen from './components/StartScreen';
import IntroSequence from './components/IntroSequence';
import ObservationPhase from './components/ObservationPhase';
import StoryPhase from './components/StoryPhase';
import MixingPhase from './components/MixingPhase';
import ResultPhase from './components/ResultPhase';
import Diary from './components/Diary';
import BookModal from './components/BookModal';
import SettingsModal from './components/SettingsModal';
import { GUESTS, GUEST_SCHEDULE } from './data/gameData';
import { BookOpen, Settings, Book } from 'lucide-react';
import { useImagePreloader } from './hooks/useImagePreloader';

type GamePhase = 'start_screen' | 'intro_sequence' | 'intro' | 'observation' | 'story' | 'mixing' | 'result';

export default function App() {
  const [phase, setPhase] = useState<GamePhase>('start_screen');
  const [currentWeek, setCurrentWeek] = useState(1);
  const [currentDay, setCurrentDay] = useState(1);
  const [currentGuestInDay, setCurrentGuestInDay] = useState(1); // 1 or 2
  const [characterProgress, setCharacterProgress] = useState<Record<string, number>>({});
  const [discoveredFeatures, setDiscoveredFeatures] = useState<string[]>([]);
  const [isMixing, setIsMixing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [mixedDrinkName, setMixedDrinkName] = useState<string | undefined>();
  const [isNewRecipe, setIsNewRecipe] = useState(false);
  const [unlockedRecipes, setUnlockedRecipes] = useState<string[]>([]);
  const [inventory, setInventory] = useState<string[]>([]);
  
  const [isDiaryOpen, setIsDiaryOpen] = useState(false);
  const [isBookOpen, setIsBookOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [transitionState, setTransitionState] = useState<'idle' | 'fade-out' | 'fade-in'>('idle');

  // Story state
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const [teachingNode, setTeachingNode] = useState<any>(null);
  const [mixingNode, setMixingNode] = useState<any>(null);

  // Determine current guest based on schedule
  const guestId = GUEST_SCHEDULE[(currentDay - 1) % 7][currentGuestInDay - 1];
  const guest = GUESTS.find(g => g.id === guestId) || GUESTS[0];
  
  const guestPhaseIndex = characterProgress[guest.id] || 0;
  const startNodeId = guest.startNodeIds[guestPhaseIndex] || guest.startNodeIds[guest.startNodeIds.length - 1];

  const imagesToPreload = useMemo(() => {
    const urls = [
      '/assets/back_grounds/main_page.png',
      '/assets/back_grounds/table.png',
    ];
    GUESTS.forEach(g => {
      urls.push(g.image);
    });
    return urls;
  }, []);

  const { imagesPreloaded } = useImagePreloader(imagesToPreload);

  const transitionTo = (nextPhase: GamePhase, delay = 800) => {
    setTransitionState('fade-out');
    setTimeout(() => {
      setPhase(nextPhase);
      setTransitionState('fade-in');
      setTimeout(() => {
        setTransitionState('idle');
      }, delay);
    }, delay);
  };

  const handleObservationComplete = (features: string[]) => {
    setDiscoveredFeatures(features);
    setCurrentNodeId(startNodeId);
    transitionTo('story');
  };

  const handleEnterMixing = (tNode: any, mNode: any) => {
    setTeachingNode(tNode);
    setMixingNode(mNode);
    transitionTo('mixing');
  };

  const handleServe = (base: string, addons: string[]) => {
    let success = false;
    
    let idealDrink;
    if (teachingNode?.teaching?.recipe?.formula) {
      idealDrink = {
        base: teachingNode.teaching.recipe.formula[0],
        addons: teachingNode.teaching.recipe.formula.slice(1)
      };
    } else if (mixingNode?.drink_request?.preferred_drink?.formula) {
      idealDrink = {
        base: mixingNode.drink_request.preferred_drink.formula[0],
        addons: mixingNode.drink_request.preferred_drink.formula.slice(1)
      };
    }

    if (!idealDrink) {
      success = true;
    } else {
      const isBaseCorrect = base === idealDrink.base;
      const isAddonsCorrect = addons.length === idealDrink.addons.length && addons.every(a => idealDrink.addons.includes(a));
      success = isBaseCorrect && isAddonsCorrect;
    }

    setIsSuccess(success);
    
    const nextNodeId = success ? (mixingNode?.on_mixing_complete || mixingNode?.next_node) : (mixingNode?.on_mixing_fail || mixingNode?.next_node);
    setCurrentNodeId(nextNodeId || null);
    
    // Find if it matches a known recipe
    import('./assets/recipes/recipes.json').then(recipesData => {
      const mixedFormula = [base, ...addons].filter(Boolean).sort();
      const matchedRecipe = recipesData.recipes.find(r => {
        if (!r.formula) return false;
        const rFormula = [...r.formula].sort();
        return rFormula.length === mixedFormula.length && rFormula.every((id, i) => id === mixedFormula[i]);
      });

      if (matchedRecipe) {
        setMixedDrinkName(matchedRecipe.name);
        if (!unlockedRecipes.includes(matchedRecipe.id)) {
          setIsNewRecipe(true);
          setUnlockedRecipes(prev => [...prev, matchedRecipe.id]);
        } else {
          setIsNewRecipe(false);
        }
      } else {
        setMixedDrinkName(undefined);
        setIsNewRecipe(false);
      }
      
      setIsMixing(false);
      transitionTo('result');
    });
  };

  // Initialize progress for current guest if not exists
  useEffect(() => {
    if (guest && characterProgress[guest.id] === undefined) {
      setCharacterProgress(prev => ({
        ...prev,
        [guest.id]: 0
      }));
    }
  }, [guest, characterProgress]);

  const handleNextGuest = () => {
    setCurrentNodeId(null);
    setTeachingNode(null);
    setMixingNode(null);
    
    if (isSuccess) {
      setCharacterProgress(prev => ({
        ...prev,
        [guest.id]: (prev[guest.id] || 0) + 1
      }));
    }

    if (currentGuestInDay === 1) {
      setCurrentGuestInDay(2);
    } else {
      setCurrentGuestInDay(1);
      let nextDay = currentDay + 1;
      let nextWeek = currentWeek;
      if (nextDay > 7) {
        nextDay = 1;
        nextWeek++;
      }
      setCurrentDay(nextDay);
      setCurrentWeek(nextWeek);
    }
    
    transitionTo('intro');
  };

  const handleReward = (reward: any) => {
    if (reward?.details?.id) {
      setInventory(prev => {
        if (!prev.includes(reward.details.id)) {
          return [...prev, reward.details.id];
        }
        return prev;
      });
    }
  };

  const handleSave = () => {
    const saveData = {
      phase,
      currentWeek,
      currentDay,
      currentGuestInDay,
      characterProgress,
      unlockedRecipes,
      discoveredFeatures,
      inventory,
      isSuccess,
      currentNodeId
    };
    localStorage.setItem('izakaya_save', JSON.stringify(saveData));
  };

  const handleLoad = () => {
    const saved = localStorage.getItem('izakaya_save');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setPhase(data.phase);
        if (data.currentWeek) setCurrentWeek(data.currentWeek);
        if (data.currentDay) setCurrentDay(data.currentDay);
        if (data.currentGuestInDay) setCurrentGuestInDay(data.currentGuestInDay);
        if (data.characterProgress) setCharacterProgress(data.characterProgress);
        if (data.unlockedRecipes) setUnlockedRecipes(data.unlockedRecipes);
        if (data.inventory) setInventory(data.inventory);
        if (data.currentNodeId) setCurrentNodeId(data.currentNodeId);
        setDiscoveredFeatures(data.discoveredFeatures || []);
        setIsSuccess(data.isSuccess || false);
      } catch (e) {
        console.error("Failed to load save data", e);
      }
    }
  };

  if (!imagesPreloaded) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-2xl font-bold animate-pulse">Loading Assets...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans overflow-hidden relative">
      <div className={`absolute inset-0 transition-opacity duration-800 ${transitionState === 'fade-out' ? 'opacity-0' : 'opacity-100'}`}>
        
        {/* Background */}
        {(phase === 'start_screen' || phase === 'intro_sequence') ? (
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/assets/back_grounds/main_page.png')" }} />
        ) : (
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/assets/back_grounds/table.png')" }} />
        )}

        {/* Top UI Bar */}
        {phase !== 'start_screen' && phase !== 'intro_sequence' && (
          <div className="absolute top-4 left-4 right-4 flex justify-between items-start z-50">
            <div className="bg-black/50 backdrop-blur-sm p-4 rounded-lg border border-white/20">
              <div className="text-sm text-gray-300">第 {currentWeek} 周</div>
              <div className="text-xl font-bold">星期 {['一', '二', '三', '四', '五', '六', '日'][currentDay - 1]}</div>
              <div className="text-sm text-amber-400 mt-1">
                {currentGuestInDay === 1 ? '黄昏' : '深夜'}
              </div>
            </div>
            
            <div className="flex gap-4">
              <button 
                onClick={() => setIsDiaryOpen(true)}
                className="bg-black/50 hover:bg-black/70 p-3 rounded-full border border-white/20 transition-colors"
                title="日记"
              >
                <BookOpen size={24} />
              </button>
              <button 
                onClick={() => setIsBookOpen(true)}
                className="bg-black/50 hover:bg-black/70 p-3 rounded-full border border-white/20 transition-colors"
                title="配方书"
              >
                <Book size={24} />
              </button>
              <button 
                onClick={() => setIsSettingsOpen(true)}
                className="bg-black/50 hover:bg-black/70 p-3 rounded-full border border-white/20 transition-colors"
                title="设置"
              >
                <Settings size={24} />
              </button>
            </div>
          </div>
        )}

        {/* Modals */}
        {isDiaryOpen && <Diary guest={guest} discoveredFeatures={discoveredFeatures} onClose={() => setIsDiaryOpen(false)} />}
        {isBookOpen && <BookModal onClose={() => setIsBookOpen(false)} characterProgress={characterProgress} />}
        {isSettingsOpen && <SettingsModal onClose={() => setIsSettingsOpen(false)} onSave={handleSave} onLoad={handleLoad} />}

        {/* Main Content Area */}
        <div className="relative w-full h-full">
          
          {/* Start Screen */}
          {phase === 'start_screen' && (
            <StartScreen onStart={() => transitionTo('intro_sequence')} />
          )}

          {/* Intro Sequence */}
          {phase === 'intro_sequence' && (
            <IntroSequence onComplete={() => transitionTo('intro')} />
          )}

          {/* Intro Phase */}
          {phase === 'intro' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80">
              <div className="text-center animate-fade-in">
                <h2 className="text-4xl font-bold mb-4">
                  {currentGuestInDay === 1 ? '黄昏时分' : '夜色渐深'}
                </h2>
                <p className="text-xl text-gray-400 mb-8">
                  门铃响了...
                </p>
                <button 
                  onClick={() => {
                    setDiscoveredFeatures([]);
                    transitionTo('observation');
                  }}
                  className="px-8 py-3 bg-white text-black font-bold rounded hover:bg-gray-200 transition-colors"
                >
                  迎接客人
                </button>
              </div>
            </div>
          )}

          {/* Observation Phase */}
          {phase === 'observation' && (
            <ObservationPhase 
              guest={guest} 
              onComplete={handleObservationComplete} 
            />
          )}

          {/* Story Phase */}
          {phase === 'story' && (
            <StoryPhase 
              guest={guest} 
              startNodeId={startNodeId}
              currentNodeId={currentNodeId}
              discoveredFeatures={discoveredFeatures}
              onNodeChange={setCurrentNodeId}
              onEnterMixing={handleEnterMixing}
              onComplete={handleNextGuest}
              onReward={handleReward}
            />
          )}

          {/* Mixing Phase */}
          {phase === 'mixing' && (
            <MixingPhase 
              guest={guest}
              onServe={handleServe}
              isMixing={isMixing}
              setIsMixing={setIsMixing}
              teaching={teachingNode?.teaching}
            />
          )}

          {/* Mixing Animation Overlay */}
          {isMixing && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-50 animate-fade-in bg-black/80 backdrop-blur-sm">
              <div className="text-8xl animate-shake mb-8">🍸</div>
              <div className="text-3xl font-bold text-amber-200 animate-pulse">调配中...</div>
            </div>
          )}

          {/* Result Phase (Cocktail Display) */}
          {phase === 'result' && (
            <ResultPhase 
              isSuccess={isSuccess} 
              mixedDrinkName={mixedDrinkName}
              isNewRecipe={isNewRecipe}
              onContinue={() => transitionTo('story')} 
            />
          )}

        </div>
      </div>
    </div>
  );
}
