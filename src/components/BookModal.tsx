import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import recipesData from '../assets/recipes/recipes.json';
import { GUESTS, getCocktailImage, getIngredientImage } from '../data/gameData';

interface Props {
  onClose: () => void;
  characterProgress: Record<string, number>;
  characterObservations: Record<string, string[]>;
  inventory: string[];
  unlockedRecipes: string[];
}

type Tab = 'items' | 'recipes' | 'characters';

interface ItemEntry {
  id: string;
  name: string;
  image?: string;
  category: string;
  tag1?: string;
  tag2?: string;
  emotion_tag?: string;
  gallery_description?: string;
  unlocked: boolean;
  sectionId: string;
  sectionLabel: string;
  sectionMark: string;
}

interface RecipeEntry {
  id: string;
  name: string;
  image?: string;
  formula?: string[];
  tag1?: string;
  tag2?: string;
  emotion_tags?: string[];
  gallery_description?: string;
  target_npc?: string;
  series?: string;
  unlocked: boolean;
}

interface CharacterStory {
  id: string;
  title: string;
  summary: string;
  unlocked: boolean;
}

interface CharacterEntry {
  id: string;
  name: string;
  type: string;
  image: string;
  unlocked: boolean;
  observedNotes: Array<{ id: string; name: string; desc: string }>;
  totalFeatures: number;
  personality: string;
  stories: CharacterStory[];
}

function PixelButton({
  onClick,
  disabled,
  title,
  className = '',
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`pixel-button pixel-rounded-lg flex items-center justify-center ${className}`}
    >
      {children}
    </button>
  );
}

function pageClass(side: 'left' | 'right') {
  const edge =
    side === 'left'
      ? 'shadow-[inset_-1px_0_0_rgba(212,184,134,0.12)]'
      : 'shadow-[inset_1px_0_0_rgba(212,184,134,0.12)]';
  return `relative flex min-h-0 flex-1 flex-col bg-[#2c1e16] px-8 py-8 text-[#e8dcc4] ${edge}`;
}

function renderIcon(
  mark: string,
  label: string,
  muted = false,
  image?: string,
  framelessImage = false,
  sizeClass = 'h-14 w-14'
) {
  if (image && framelessImage) {
    return (
      <div className={`flex items-center justify-center ${sizeClass}`}>
        <img
          src={image}
          alt={label}
          className={`h-full w-full object-contain ${muted ? 'opacity-45 grayscale' : ''}`}
        />
      </div>
    );
  }

  return (
    <div
      className={`flex ${sizeClass} flex-col items-center justify-center border-4 text-[10px] font-bold leading-none ${
        muted
          ? 'border-[#8a7a64] bg-[#b9ac94] text-[#f6eedc]'
          : 'border-[#734523] bg-[#efc786] text-[#4a2b16]'
      }`}
    >
      {image ? (
        <img
          src={image}
          alt={label}
          className={`h-full w-full object-contain p-1 ${muted ? 'opacity-45 grayscale' : ''}`}
        />
      ) : (
        <>
          <span className="text-lg">{mark}</span>
          <span>{label}</span>
        </>
      )}
    </div>
  );
}

function uniqueTags(tags: Array<string | undefined>) {
  return [...new Set(tags.filter(Boolean) as string[])];
}

function buildPlaceholderStories(guestName: string): CharacterStory[] {
  return [
    {
      id: 'story-1',
      title: '故事一',
      summary: `${guestName} 的第一段人物故事待补充。`,
      unlocked: true,
    },
    {
      id: 'story-2',
      title: '故事二',
      summary: `${guestName} 的第二段人物故事待补充。`,
      unlocked: false,
    },
    {
      id: 'story-3',
      title: '故事三',
      summary: `${guestName} 的第三段人物故事待补充。`,
      unlocked: false,
    },
  ];
}

export default function BookModal({
  onClose,
  characterProgress,
  characterObservations,
  inventory,
  unlockedRecipes,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('items');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [characterPage, setCharacterPage] = useState(0);

  const items = useMemo<ItemEntry[]>(() => {
    const groups = [
      { id: 'japanese-bases', label: '日式基底酒', mark: '基', values: recipesData.ingredients.bases.japanese },
      { id: 'classic-bases', label: '经典基底酒', mark: '典', values: recipesData.ingredients.bases.classic },
      { id: 'mixers', label: '配酒', mark: '调', values: recipesData.ingredients.mixers },
      { id: 'flavors', label: '风味剂', mark: '味', values: recipesData.ingredients.flavors },
    ];

    return groups.flatMap(group =>
      group.values
        .map(item => ({
          ...item,
          image: getIngredientImage(item.id),
          unlocked: Boolean(item.unlocked) || inventory.includes(item.id),
          sectionId: group.id,
          sectionLabel: group.label,
          sectionMark: group.mark,
        }))
        .sort((a, b) => {
          if (a.unlocked !== b.unlocked) {
            return a.unlocked ? -1 : 1;
          }
          return a.name.localeCompare(b.name, 'zh-Hans-CN');
        })
    );
  }, [inventory]);

  const itemLookup = useMemo(() => new Map(items.map(item => [item.id, item])), [items]);

  const itemSections = useMemo(
    () =>
      [
        { id: 'japanese-bases', label: '日式基底酒' },
        { id: 'classic-bases', label: '经典基底酒' },
        { id: 'mixers', label: '配酒' },
        { id: 'flavors', label: '风味剂' },
      ].map(section => ({
        ...section,
        items: items.filter(item => item.sectionId === section.id),
      })),
    [items]
  );

  const recipes = useMemo<RecipeEntry[]>(() => {
    const unlockedItemIds = new Set(items.filter(item => item.unlocked).map(item => item.id));
    return [...recipesData.recipes]
      .map(recipe => ({
        ...recipe,
        image: getCocktailImage(recipe.id, recipe.name),
        unlocked:
          Boolean((recipe as { unlocked?: boolean }).unlocked) ||
          unlockedRecipes.includes(recipe.id) ||
          (Array.isArray(recipe.formula) && recipe.formula.every(id => unlockedItemIds.has(id))),
      }))
      .sort((a, b) => {
        if (a.unlocked !== b.unlocked) {
          return a.unlocked ? -1 : 1;
        }
        return a.name.localeCompare(b.name, 'zh-Hans-CN');
      });
  }, [items, unlockedRecipes]);

  const characters = useMemo<CharacterEntry[]>(
    () =>
      GUESTS.map(guest => {
        const observedIds = characterObservations[guest.id] || [];
        const observedNotes = observedIds
          .map(id => guest.features.find(feature => feature.id === id))
          .filter(Boolean)
          .map(feature => ({
            id: feature!.id,
            name: feature!.name,
            desc: feature!.desc,
          }));

        const sourceStories =
          guest.meta?.character_stories ||
          guest.meta?.stories ||
          guest.meta?.story_entries ||
          [];

        const stories: CharacterStory[] =
          Array.isArray(sourceStories) && sourceStories.length > 0
            ? sourceStories.map((story: any, index: number) => ({
                id: story.id || `story-${index + 1}`,
                title: story.title || story.name || `故事 ${index + 1}`,
                summary: story.summary || story.desc || story.description || '这段人物故事待补充。',
                unlocked: story.unlocked !== false,
              }))
            : buildPlaceholderStories(guest.name);

        return {
          id: guest.id,
          name: guest.name,
          type: guest.type,
          image: guest.image,
          unlocked: characterProgress[guest.id] !== undefined || observedNotes.length > 0,
          observedNotes,
          totalFeatures: guest.features.length,
          personality:
            guest.meta?.base_info?.description ||
            guest.meta?.description ||
            guest.meta?.personality ||
            guest.meta?.base_info?.intro ||
            guest.meta?.base_info?.summary ||
            '这位客人的性格记录还不完整。',
          stories,
        };
      }).sort((a, b) => {
        if (a.unlocked !== b.unlocked) {
          return a.unlocked ? -1 : 1;
        }
        return a.name.localeCompare(b.name, 'zh-Hans-CN');
      }),
    [characterObservations, characterProgress]
  );

  useEffect(() => {
    if (!selectedItemId || !itemLookup.has(selectedItemId)) {
      setSelectedItemId(items.find(item => item.unlocked)?.id || items[0]?.id || null);
    }
  }, [itemLookup, items, selectedItemId]);

  useEffect(() => {
    const recipeIds = new Set(recipes.map(recipe => recipe.id));
    if (!selectedRecipeId || !recipeIds.has(selectedRecipeId)) {
      setSelectedRecipeId(recipes.find(recipe => recipe.unlocked)?.id || recipes[0]?.id || null);
    }
  }, [recipes, selectedRecipeId]);

  useEffect(() => {
    if (characterPage >= characters.length) {
      setCharacterPage(Math.max(0, characters.length - 1));
    }
  }, [characterPage, characters.length]);

  const selectedItem = selectedItemId ? itemLookup.get(selectedItemId) || null : null;
  const selectedRecipe = selectedRecipeId
    ? recipes.find(recipe => recipe.id === selectedRecipeId) || null
    : null;
  const selectedCharacter = characters[characterPage] || null;

  const itemMainTags = selectedItem
    ? uniqueTags([selectedItem.tag1, selectedItem.tag2, selectedItem.emotion_tag])
    : [];
  const recipeTags = selectedRecipe
    ? uniqueTags([selectedRecipe.tag1, selectedRecipe.tag2, ...(selectedRecipe.emotion_tags || [])])
    : [];
  const itemCategory =
    selectedItem && selectedItem.category !== selectedItem.sectionLabel
      ? selectedItem.category
      : selectedItem?.sectionLabel;

  return (
    <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm">
      <div className="relative flex h-[86vh] w-[92vw] max-w-7xl flex-col overflow-hidden border-[6px] border-[#1a110c] bg-[#1c1411] text-[#e8dcc4] shadow-[0_0_60px_rgba(0,0,0,0.75)] animate-scale-up pixel-rounded-lg">
        <PixelButton
          onClick={onClose}
          title="关闭图鉴"
          className="absolute right-6 top-6 z-30 h-12 w-12 px-0 text-[#fff2d7] !bg-[#b86943] !border-[#6a351e] !border-b-[#4d2313]"
        >
          <X size={18} />
        </PixelButton>

        <div className="flex border-b-[6px] border-[#1a110c] bg-[#2c1e16] pr-20">
          {[
            { id: 'items', label: '物品图鉴' },
            { id: 'recipes', label: '酒谱配方' },
            { id: 'characters', label: '人物图鉴' },
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as Tab)}
              className={`px-6 py-4 text-lg font-bold tracking-[0.15em] border-r-4 border-[#6f4b2c] ${
                activeTab === tab.id ? 'bg-[#4a3f35] text-[#fff1d8]' : 'bg-[#2c1e16] text-[#bda98a]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative min-h-0 flex-1 overflow-hidden bg-[#1a110c]">
          <div className="pointer-events-none absolute inset-y-0 left-1/2 z-10 w-6 -translate-x-1/2 bg-[linear-gradient(90deg,#241811_0%,#4a3f35_50%,#241811_100%)]" />

          {activeTab === 'items' && (
            <div className="flex h-full">
              <section className={pageClass('left')}>
                <div className="mb-4 border-b-2 border-[#b18859] pb-3">
                  <div className="text-sm tracking-[0.3em] text-[#8b5a2b]">ITEMS</div>
                  <h2 className="mt-2 text-3xl font-bold">材料目录</h2>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto pr-3 custom-scrollbar">
                  <div className="space-y-4">
                    {itemSections.map(section => (
                      <div key={section.id} className="border-2 border-[#4a3f35] bg-[#1a110c] p-4 pixel-rounded-lg">
                        <div className="mb-3 flex items-center justify-between border-b border-[#4a3f35] pb-2">
                          <div className="text-lg font-bold">{section.label}</div>
                          <div className="text-xs text-[#a38c66]">
                            {section.items.filter(item => item.unlocked).length}/{section.items.length}
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          {section.items.map(item => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setSelectedItemId(item.id)}
                              className={`border-4 p-2 text-center transition-colors pixel-rounded-lg ${
                                selectedItem?.id === item.id
                                  ? 'border-[#d4b886] bg-[#4a3f35]'
                                  : 'border-[#3e2723] bg-[#1a110c] hover:border-[#8b5a2b]'
                              }`}
                            >
                              <div className="flex flex-col items-center gap-2">
                                {renderIcon(item.sectionMark, item.id.toUpperCase().slice(-2), !item.unlocked, item.image, true, 'h-24 w-24')}
                                <div className={`text-xs ${item.unlocked ? 'text-[#e8dcc4]' : 'text-[#8c7d67]'}`}>
                                  {item.unlocked ? item.name : '未解锁'}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section className={pageClass('right')}>
                <div className="mb-4 border-b-2 border-[#b18859] pb-3">
                  <div className="text-sm tracking-[0.3em] text-[#8b5a2b]">DETAIL</div>
                  <h2 className="mt-2 text-3xl font-bold text-[#e8dcc4]">材料条目</h2>
                </div>

                {selectedItem ? (
                  <div className="min-h-0 flex-1 overflow-y-auto pr-3 custom-scrollbar">
                    <div className="flex flex-col gap-4">
                      <div className="border-2 border-[#4a3f35] bg-[#1a110c] p-5 pixel-rounded-lg">
                        <div className="flex flex-col items-start gap-4">
                          {renderIcon(selectedItem.sectionMark, selectedItem.id.toUpperCase().slice(-2), !selectedItem.unlocked, selectedItem.image, true, 'h-28 w-28')}
                          <div className="w-full">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-3xl font-bold">
                                {selectedItem.unlocked ? selectedItem.name : '未解锁材料'}
                              </h3>
                              {itemMainTags.map(tag => (
                                <span
                                  key={tag}
                                  className="border border-[#4a3f35] bg-[#2c1e16] px-2 py-1 text-xs text-[#d4b886]"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                            <div className="mt-2 text-sm text-[#a38c66]">{itemCategory}</div>
                          </div>
                        </div>
                      </div>

                      <div className="border-2 border-[#4a3f35] bg-[#1a110c] p-4 pixel-rounded-lg">
                        <div className="text-sm tracking-[0.2em] text-[#8b5a2b]">条目说明</div>
                        <p className="mt-3 leading-7 text-[#d8c7a8]">
                          {selectedItem.unlocked
                            ? selectedItem.gallery_description || '这份材料暂时还没有额外记录。'
                            : '这份材料还没有真正入手，只留下了一条空白条目。'}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-1 items-center justify-center text-lg text-[#8d7250]">
                    还没有可以查看的材料条目。
                  </div>
                )}
              </section>
            </div>
          )}

          {activeTab === 'recipes' && (
            <div className="flex h-full">
              <section className={pageClass('left')}>
                <div className="mb-4 border-b-2 border-[#b18859] pb-3">
                  <div className="text-sm tracking-[0.3em] text-[#8b5a2b]">RECIPES</div>
                  <h2 className="mt-2 text-3xl font-bold text-[#e8dcc4]">酒谱索引</h2>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto pr-3 custom-scrollbar">
                  <div className="space-y-3">
                    {recipes.map(recipe => (
                      <button
                        key={recipe.id}
                        type="button"
                        onClick={() => setSelectedRecipeId(recipe.id)}
                        className={`flex w-full items-center gap-4 border-4 px-4 py-3 text-left transition-colors pixel-rounded-lg ${
                          selectedRecipe?.id === recipe.id
                            ? 'border-[#d4b886] bg-[#4a3f35]'
                            : 'border-[#3e2723] bg-[#1a110c] hover:border-[#8b5a2b]'
                        }`}
                      >
                        {renderIcon('酒', recipe.id.slice(-2), !recipe.unlocked, recipe.image, true, 'h-24 w-24')}
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-lg font-bold">
                            {recipe.unlocked ? recipe.name : '未解锁酒谱'}
                          </div>
                          <div className="mt-1 truncate text-sm text-[#a38c66]">
                            {recipe.unlocked ? recipe.series || '通用配方' : '仍缺少配方线索'}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              <section className={pageClass('right')}>
                <div className="mb-4 border-b-2 border-[#b18859] pb-3">
                  <div className="text-sm tracking-[0.3em] text-[#8b5a2b]">FORMULA</div>
                  <h2 className="mt-2 text-3xl font-bold text-[#e8dcc4]">配方详情</h2>
                </div>

                {selectedRecipe ? (
                  <div className="min-h-0 flex-1 overflow-y-auto pr-3 custom-scrollbar">
                    <div className="flex flex-col gap-4">
                      <div className="border-2 border-[#4a3f35] bg-[#1a110c] p-5 pixel-rounded-lg">
                        <div className="flex items-start gap-4">
                          {renderIcon('谱', selectedRecipe.id.slice(-2), !selectedRecipe.unlocked, selectedRecipe.image, true, 'h-28 w-28')}
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-3xl font-bold">
                                {selectedRecipe.unlocked ? selectedRecipe.name : '未解锁酒谱'}
                              </h3>
                              {recipeTags.map(tag => (
                                <span
                                  key={tag}
                                  className="border border-[#4a3f35] bg-[#2c1e16] px-2 py-1 text-xs text-[#d4b886]"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                            <div className="mt-2 text-sm text-[#a38c66]">
                              {selectedRecipe.unlocked ? selectedRecipe.series || '通用配方' : '未记录'}
                            </div>
                            <p className="mt-4 leading-7 text-[#d8c7a8]">
                              {selectedRecipe.unlocked
                                ? selectedRecipe.gallery_description || '这张配方卡还没有写下更多说明。'
                                : '这页上只留下了模糊的名字，详细配方还没有被记下来。'}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="border-2 border-[#4a3f35] bg-[#1a110c] p-4 pixel-rounded-lg">
                        <div className="text-sm tracking-[0.2em] text-[#8b5a2b]">配方组成</div>
                        {selectedRecipe.unlocked && selectedRecipe.formula?.length ? (
                          <div className="mt-4 grid grid-cols-2 gap-3">
                            {selectedRecipe.formula.map(id => {
                              const ingredient = itemLookup.get(id);
                              return (
                                <div
                                  key={id}
                                  className="flex items-center gap-3 border-2 border-[#4a3f35] bg-[#2c1e16] px-3 py-3 pixel-rounded-lg"
                                >
                                  {renderIcon(
                                    ingredient?.sectionMark || '料',
                                    id.toUpperCase().slice(-2),
                                    !ingredient?.unlocked,
                                    ingredient?.image,
                                    true,
                                    'h-24 w-24'
                                  )}
                                  <div className="min-w-0">
                                    <div className="truncate font-bold text-[#e8dcc4]">
                                      {ingredient?.name || id}
                                    </div>
                                    <div className="truncate text-sm text-[#a38c66]">
                                      {ingredient?.sectionLabel || ingredient?.category || '未知分类'}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="mt-4 text-sm italic text-[#8d7250]">
                            配方组成还没有完全显现。
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-1 items-center justify-center text-lg text-[#8d7250]">
                    还没有可以查看的酒谱条目。
                  </div>
                )}
              </section>
            </div>
          )}

          {activeTab === 'characters' && selectedCharacter && (
            <div className="relative flex h-full">
              <section className={pageClass('left')}>
                <div className="mb-4 border-b-2 border-[#b18859] pb-3">
                  <div className="text-sm tracking-[0.3em] text-[#8b5a2b]">CHARACTER</div>
                  <h2 className="mt-2 text-3xl font-bold text-[#e8dcc4]">人物档案</h2>
                </div>

                <div className="min-h-0 flex flex-1 flex-col gap-4">
                  <div className="flex h-[42%] min-h-[220px] items-center justify-center border-2 border-[#4a3f35] bg-[#1a110c] p-4 pixel-rounded-lg">
                    {selectedCharacter.unlocked ? (
                      <img
                        src={selectedCharacter.image}
                        alt={selectedCharacter.name}
                        className="max-h-full w-full object-contain"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center border-4 border-dashed border-[#b99f78] bg-[#d8cbb0] text-[#8b7b63] pixel-rounded-lg">
                        尚未登场
                      </div>
                    )}
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto pr-3 custom-scrollbar">
                    <div className="space-y-4">
                      <div className="border-2 border-[#4a3f35] bg-[#1a110c] p-4 pixel-rounded-lg">
                        <div className="text-3xl font-bold">
                          {selectedCharacter.unlocked ? selectedCharacter.name : '未解锁人物'}
                        </div>
                        <div className="mt-2 text-sm text-[#a38c66]">
                          {selectedCharacter.unlocked ? selectedCharacter.type : '尚未记录'}
                        </div>
                        <p className="mt-4 leading-7 text-[#d8c7a8]">
                          {selectedCharacter.unlocked
                            ? selectedCharacter.personality
                            : '这位客人的档案页还没有形成清晰轮廓。'}
                        </p>
                      </div>

                      <div className="border-2 border-[#4a3f35] bg-[#1a110c] p-4 pixel-rounded-lg">
                        <div className="flex items-center justify-between gap-4 border-b border-[#d0b381] pb-2">
                          <div className="text-lg font-bold">人物故事</div>
                          <div className="text-xs text-[#8b5a2b]">
                            {selectedCharacter.stories.length} 条
                          </div>
                        </div>
                        <div className="mt-3 space-y-3">
                          {selectedCharacter.stories.map(story => (
                            <div
                              key={story.id}
                              className={`border-2 px-3 py-3 pixel-rounded-lg ${
                                story.unlocked
                                  ? 'border-[#4a3f35] bg-[#2c1e16]'
                                  : 'border-[#3e2723] bg-[#19120e] text-[#7a6f5d]'
                              }`}
                            >
                              <div className="font-bold">{story.title}</div>
                              <div className="mt-2 text-sm leading-6">{story.summary}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className={pageClass('right')}>
                <div className="mb-4 border-b-2 border-[#b18859] pb-3">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm tracking-[0.3em] text-[#8b5a2b]">OBSERVE</div>
                      <h2 className="mt-2 text-3xl font-bold text-[#e8dcc4]">观察记录</h2>
                    </div>
                    <div className="text-right text-sm text-[#8b5a2b]">
                      已记录 {selectedCharacter.observedNotes.length}/{selectedCharacter.totalFeatures}
                    </div>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto pr-3 custom-scrollbar">
                  {selectedCharacter.unlocked ? (
                    <div className="space-y-3">
                      {selectedCharacter.observedNotes.length > 0 ? (
                        selectedCharacter.observedNotes.map((note, index) => (
                          <article
                            key={note.id}
                            className="border-2 border-[#4a3f35] bg-[#1a110c] p-4 pixel-rounded-lg"
                          >
                            <div className="flex items-center justify-between gap-4 border-b border-[#d0b381] pb-2">
                              <div className="text-lg font-bold">{note.name}</div>
                              <div className="text-xs text-[#8b5a2b]">观察 {index + 1}</div>
                            </div>
                            <p className="mt-3 leading-7 text-[#d8c7a8]">{note.desc}</p>
                          </article>
                        ))
                      ) : (
                        <div className="border-2 border-dashed border-[#c7a270] bg-[#f7ebcc] p-5 text-sm italic text-[#8d7250] pixel-rounded-lg">
                          这位客人已经登场，但还没有通过观察阶段记录到具体细节。
                        </div>
                      )}

                      {selectedCharacter.observedNotes.length < selectedCharacter.totalFeatures && (
                        <div className="border-2 border-dashed border-[#c7a270] bg-[#f7ebcc] p-4 text-sm italic text-[#8d7250] pixel-rounded-lg">
                          还有 {selectedCharacter.totalFeatures - selectedCharacter.observedNotes.length} 条观察尚未写入图鉴。
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-[#c7a270] bg-[#f7ebcc] p-5 text-sm italic text-[#8d7250] pixel-rounded-sm">
                      等这位客人真正来到居酒屋后，这一页才会慢慢出现内容。
                    </div>
                  )}
                </div>
              </section>

              <PixelButton
                onClick={() => setCharacterPage(page => Math.max(0, page - 1))}
                disabled={characterPage === 0}
                title="上一页"
                className="absolute left-4 top-1/2 z-20 h-14 w-14 -translate-y-1/2 px-0"
              >
                <ChevronLeft size={18} />
              </PixelButton>

              <PixelButton
                onClick={() => setCharacterPage(page => Math.min(characters.length - 1, page + 1))}
                disabled={characterPage >= characters.length - 1}
                title="下一页"
                className="absolute right-4 top-1/2 z-20 h-14 w-14 -translate-y-1/2 px-0"
              >
                <ChevronRight size={18} />
              </PixelButton>

              <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 -translate-x-1/2 border-2 border-[#7a5331] bg-[#f1ddae] px-3 py-1 text-sm text-[#6b4322] pixel-rounded-lg">
                第 {characterPage + 1} / {Math.max(characters.length, 1)} 页
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
