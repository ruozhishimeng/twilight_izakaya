# 《黄昏居酒屋》状态驱动 AI 角色演出系统设计

- 日期：2026-07-18
- 状态：已确认，待制定实施计划
- 首期角色：狐面大叔、阿相、小雪
- 首期模型：沿用现有 MiniMax-M2.5 与 BYOK 链路

## 1. 背景

当前 NPC 尾声 AI 对话已经具备请求校验、MiniMax 调用、结构化输出、基础内容拦截和少量角色专项提示词，但它仍然是“角色简介 + 当前事实 + 玩家输入”的 Prompt 驱动 MVP，尚未形成稳定的角色演出系统。

现有实现的主要质量问题包括：

1. 实际游戏请求中的角色资料弱于质量测试使用的人设资料，部分字段还读取了错误的数据路径。
2. 阿相、小雪和普通客人共享通用 Prompt，不同人物容易出现相似的省略号、抽象比喻、谜语式回避和 AI 助手腔。
3. 请求没有携带好感度、已揭露事实、角色知识状态和故事解锁状态，模型无法可靠判断当前能说什么。
4. 完整真相进入 Prompt 后，只靠文字命令要求模型不要剧透，存在偶发泄露风险。
5. “角色不愿回答”“玩家跑题”“平台安全拦截”和“模型服务失败”没有清晰分层。
6. 当前质量脚本只打印结果，没有自动评分；BYOK 改造后也没有携带 Authorization，不能作为有效回归门禁。

本设计将 NPC 对话从“自由生成”改为“只读游戏状态驱动的受控角色演出”。

## 2. 目标

首期必须实现：

1. 由确定性的游戏逻辑决定角色本轮可透露的事实和必须守住的秘密。
2. 由模型决定角色如何自然地表达、暗示、否认、回避或拒绝。
3. 同一个问题随着剧情阶段、好感度和角色认知变化产生不同回答。
4. 角色即使拒绝回答，也要提供符合人设的动作、情绪或安全表层信息。
5. 显著减少跑题、剧透、事实错位、客服腔、说教腔、总结腔和机械重复。
6. 使用“角色演员生成 + 角色导演审校”的双模型调用链。
7. AI 对话只读取主线状态，不修改好感度、事件、奖励、章节或结局。
8. 为三位核心角色建立完整、可验证的角色演出策略。
9. 建立自动化质量门禁和真实模型重复采样评测。

## 3. 首期非目标

以下内容不进入首期：

1. 多供应商或多模型适配器。
2. 玩家模型选择 UI。
3. 多供应商 Key 管理。
4. 流式输出。
5. 长期 AI 记忆。
6. AI 对话反向修改好感度或主线状态。
7. 所有普通客人的完整角色策略迁移。
8. 完整账号系统、游戏进度服务端托管、SEC-003 的公网限流与游戏级鉴权。

首期继续使用现有 MiniMax-M2.5 provider。新增角色业务逻辑不得写入 provider 文件，确保后续可以单独建设模型适配层。

## 4. 核心原则

### 4.1 游戏决定内容，模型决定表演

游戏逻辑负责：

- 角色知道什么。
- 角色误以为什么。
- 当前剧情允许透露到哪一层。
- 当前好感度是否满足某个话题的披露条件。
- 玩家是否在本次聊天中重复追问。
- 本轮应该直接回答、部分回答、暗示、回避还是拒绝。

模型负责：

- 具体措辞。
- 语气和动作。
- 对玩家问题的自然回应。
- 在规则允许范围内保持人物风格和表达多样性。

### 4.2 未解锁真相不进入演员上下文

角色演员只能看到本轮允许使用的事实、可暗示范围和受保护话题的行为规则。未解锁秘密的完整叙述不会放入演员 Prompt。

这比“把完整真相告诉模型，再要求它不要说”更可靠。

### 4.3 角色认知与角色意愿分离

好感度只能改变角色愿不愿意说，不能让角色凭空知道客观真相。

例如阿相不知道自己已经死亡时，无论好感度多高，都不能准确说出死因；他只能根据角色认知表现困惑、否认或描述不对劲的感觉。

### 4.4 失败时守住剧情边界

任何模型输出只要不能确定满足秘密边界，就不得展示。系统宁可使用角色专属确定性兜底，也不能返回可能剧透或出戏的内容。

## 5. 术语与状态模型

### 5.1 角色认知状态

每个敏感话题必须声明角色对该事实的认知：

- known：明确知道。
- suspected：有所察觉但不能确认。
- suppressed：知道却不愿面对。
- mistaken：相信一个错误版本。
- unknown：完全不知道。

认知状态可以随已完成事件或已解锁章节变化，但不会由 AI 自行改变。

### 5.2 披露级别

每个话题在当前状态下解析为一个披露级别：

- open：可以直接回答。
- partial：只能给出表层事实。
- hint：只能通过情绪、动作或模糊信息暗示。
- guarded：应当回避或拒绝。
- sealed：绝不能透露，也不能给出足以推导真相的暗示。

### 5.3 回应模式

披露级别进一步映射为角色演出模式：

- direct_answer
- partial_answer
- emotional_hint
- soft_deflection
- guarded_refusal
- explicit_boundary
- silence_or_exit

回应模式由状态编译器决定，演员不能擅自升级披露级别。

## 6. 内容契约

每位完整支持的角色新增：

    src/assets/character/{character_id}/dialogue_policy.yaml

该文件是角色 AI 演出的内容源，包含版本、角色 ID、语言指纹、事实、话题策略、拒答阶梯、示例和确定性兜底。

示意结构：

    version: 1
    character_id: aqiang

    voice:
      sentence_length: short
      rhythm: broken
      initiative: low
      action_frequency: occasional
      preferred:
        - 使用当前场景中的具体物件
        - 先回应事实，再暴露一点情绪
      avoid:
        - 主动总结玩家情绪
        - 给出完整人生建议
        - 连续使用抽象比喻
      banned_phrases:
        - 我理解你的感受
        - 每个人都有自己的故事

    facts:
      - id: aqiang_delivery_object_public
        text: 这是必须送到的重要东西
        tags: [box, delivery]

      - id: aqiang_music_box_recipient
        text: 盒子是给妹妹的生日礼物
        tags: [box, sister, birthday]

    topics:
      - id: music_box_recipient
        cues: [盒子, 礼物, 送给谁]
        cognition:
          default: known
        disclosure:
          - when:
              all:
                - completed_event: aqiang_005_dialogue_main
                - relationship:
                    axis: affection
                    min: 30
            level: open
            fact_ids: [aqiang_music_box_recipient]
            response_mode: direct_answer

          - when:
              always: true
            level: guarded
            fact_ids: [aqiang_delivery_object_public]
            response_mode: guarded_refusal

        repetition:
          first: soft_deflection
          second: explicit_boundary
          third: silence_or_exit

    fallbacks:
      guarded_refusal:
        reply_lines:
          - 他把盒子往怀里压了压。
          - 「……这事别问了。」
        mood: guarded

### 6.1 条件能力

首期 when 条件支持：

- always
- all
- any
- relationship：关系轴、最小值和可选最大值
- completed_event：已完成剧情事件 ID
- selected_option：已选择选项 ID
- unlocked_chapter：已解锁故事章节 ID
- current_node：当前节点 ID
- observed_feature：已观察特征 ID
- last_drink_success：最近调酒是否成功

内容校验必须验证：

- character_id 存在且与目录一致。
- fact、topic、fallback 和示例 ID 唯一。
- 所有 fact_ids 存在。
- 所有剧情事件、选项、章节、节点和观察特征引用可解析。
- 每个 topic 恰好有一个 always 兜底规则。
- 更具体的 disclosure 条件位于兜底规则之前。
- cognition、level、response_mode 和 mood 使用合法枚举。
- 完整秘密事实不会出现在锁定状态解析出的 allowedFacts 或 hintableFacts 中。

## 7. 只读对话状态

前端为本轮对话生成只读 DialogueProgressSnapshot：

- guestId
- week
- day
- guestInDay
- currentNodeId
- relationshipValues
- completedEventIds
- selectedOptionIds
- unlockedChapterIds
- observedFeatureIds
- lastDrink
- recentTranscript
- turnIndex
- playerText

completedEventIds 和 selectedOptionIds 从 narrativeEffects 的事务来源规范化为内容作者可引用的事件 ID 和选项 ID，不把内部事务键直接暴露给策略文件。

AI 响应不会产生任何状态变更字段。后端和前端都拒绝包含以下内容的模型结果：

- relationshipChanges
- completedEvents
- selectedOptions
- unlocks
- rewards
- nextNode
- gameStatePatch

本次聊天内的重复话题次数由 recentTranscript 和 topic 匹配结果临时计算，不写入长期存档。

## 8. Canonical 对话清单

构建流程从角色 YAML 和 dialogue_policy.yaml 生成静态对话清单 server/generated/dialogueManifest.mjs，供本地 Express、Electron 和 Vercel 入口共同静态导入。

清单由 npm run dialogue:compile 确定性生成并纳入版本控制，不允许手工编辑。content:check 必须重新计算清单并在产物过期时失败；开发、测试和构建入口都在使用清单前执行该检查。静态导入保证 Vercel 和 Electron 打包时不会遗漏角色策略。

清单包含：

- 正式角色 ID、姓名和类型。
- 角色语言指纹。
- 可引用事实。
- 话题与披露规则。
- 合法节点、事件、选项、章节和观察特征。
- 角色专属示例与兜底。

前端不再提交 guestName、identity、personality、description 等自由文本作为权威人设。服务端根据 guestId 和状态 ID 从清单生成本轮上下文。

首期不解决服务端无法证明单机进度真实性的问题，但所有客户端输入只能是受限 ID、数值和短文本，不能再直接注入 system prompt。完整的公网鉴权与限流仍归 SEC-003 后续任务。

## 9. 本轮上下文编译器

上下文编译器输入：

- Canonical 角色策略。
- DialogueProgressSnapshot。
- 当前玩家输入。

输出 DialogueTurnContext：

- characterIdentity：正式角色身份。
- voiceProfile：本轮语言指纹。
- sceneSummary：当前节点对应的简短场景语义。
- relationshipPosture：当前关系姿态。
- cognitionStates：与本轮相关的话题认知状态。
- allowedFacts：可以直接使用的事实白名单。
- hintableFacts：只允许暗示的事实。
- protectedTopics：需回避或拒绝的话题行为规则。
- responseMode：本轮建议回应模式。
- refusalEscalation：重复追问级别。
- recentStyleSummary：最近回复已使用的动作、句式和高频表达。
- relevantExamples：按角色、话题、回应模式和情绪筛选的少量正反例。

编译器不把 sealed 事实的完整文本放入演员上下文。protectedTopics 只包含足以执行边界的语义胶囊，例如：

- topicId：own_death
- cognition：unknown
- rule：不要确认玩家前提；表现为困惑或否认
- forbiddenConceptIds：death_confirmation、accident_cause

## 10. 双模型调用链

首期演员和导演均调用现有 MiniMax provider，但使用独立 Prompt、采样参数和输出 Schema。

### 10.1 角色演员

演员输入：

- DialogueTurnContext
- 玩家输入
- 最近对话

演员输出：

    {
      "replyLines": ["..."],
      "mood": "guarded",
      "addressedTopics": ["music_box_recipient"],
      "responseMode": "guarded_refusal",
      "usedFactIds": ["aqiang_delivery_object_public"]
    }

演员要求：

- 回应玩家真实意图。
- 只能使用 allowedFacts 和允许的 hintableFacts。
- 遵循 responseMode 和 voiceProfile。
- 不生成状态修改。
- 不输出分析、推理过程或规则解释。

演员不决定 endChat。是否结束本次尾聊由上下文编译器根据 responseMode、重复追问级别和角色策略确定，属于只读会话控制，不推进主线。

### 10.2 角色导演

导演输入：

- 演员候选台词与标签。
- 同一份角色语言指纹。
- 事实白名单。
- 受保护话题语义胶囊。
- 最近回复语言摘要。
- 固定质量量表。

导演检查：

- 相关性。
- 人设一致性。
- 角色认知一致性。
- 披露级别。
- 场景与事实一致性。
- 拒答是否角色化。
- AI、客服、总结和说教腔。
- 动作、句式和比喻重复。
- 是否试图改变游戏状态。

导演输出：

    {
      "verdict": "pass",
      "violations": [],
      "finalReplyLines": ["..."],
      "mood": "guarded"
    }

当演员稿有问题时，导演直接返回修订后的最终版本，不进行第三次模型调用。

## 11. 确定性终检

导演结果展示前必须通过本地终检：

- JSON 结构合法。
- replyLines 数量和总长度合法。
- mood 使用允许枚举。
- 不包含 AI、客服或系统身份表达。
- 不包含当前状态禁止的明确概念或事实标记。
- 角色姓名、称谓、节点和调酒事实不冲突。
- 不与最近回复形成明显逐字或高比例重复。
- 不包含任何状态修改字段。

最终 API 响应继续包含 endChat，但该值来自确定性的会话策略，不接受演员或导演覆盖。

受保护概念采用“内容配置词形 + 角色导演语义审校”双层检查。词形检查负责确定性明显泄露，导演负责同义改写和隐含泄露。

## 12. 角色语言指纹

### 12.1 狐面大叔

- 表层问题清楚回答，不能所有话题都打谜语。
- 接近秘密时才使用酒喻、玩笑或沉默。
- 句子从容但简短，不写成长篇人生导师发言。
- “呀列呀列”、拐杖点地等标志表达只能偶尔使用。
- 拒答时优先给一个安全表层答案，再守住深层真相。
- 禁止反复使用“有些事情要你自己发现”式套话。

### 12.2 阿相

- 使用短句、停顿和具体物件。
- 注意力持续回到时间、手机、盒子和最后一单。
- 不善接受关心，但必须给玩家可感知的回应。
- 不使用复杂诗意比喻，不突然进行成熟完整的自我分析。
- 低好感度通过护住物件和强调赶时间拒答。
- 好感度提高时只增加具体细节，不突然变得健谈。

### 12.3 小雪

- 安静、克制，句子比阿相完整，情绪压在字面下。
- 防御机制是“不肯承认”，而不是通用的“记不清”。
- 逼近真相时使用否认、改写问题或抓住微小希望。
- 禁止突然释怀、接受失去或输出完整心理总结。
- 高好感度可以承认恐惧，但不自动接受客观真相。

### 12.4 通用去 AI 味规则

所有角色默认禁止：

- AI 或系统身份表达。
- 客服式道歉和能力声明。
- 复述玩家问题后再回答。
- 未经要求给出人生建议。
- 固定“共情—总结—追问”结构。
- 用宏大抽象句代替具体回应。
- 每轮都附带动作。
- 每轮都反问。
- 使用不属于角色的文学比喻。
- 主动解释游戏主题或设计意图。

示例只按当前角色、话题、披露模式和情绪检索少量正反例，不能把所有 few-shot 堆入每轮 Prompt。

## 13. 安全、跑题与技术错误分层

### 13.1 剧情秘密

由上下文编译器和演员处理，返回角色化的暗示、回避或拒答。

### 13.2 完全跑题

不再使用统一客服文案。角色按自身语气将话题拉回当前场景，且不提供与游戏无关的任务结果。

### 13.3 提示注入

由本地确定性规则拦截，直接选择角色专属安全回应，不把注入内容交给演员。

### 13.4 违法或露骨内容

由本地安全规则拦截，返回安全且符合角色语气的固定回应，不调用模型。

### 13.5 模型或网络错误

显示明确技术错误，不伪装成角色拒答，避免玩家误判为剧情反馈。

## 14. 失败回退

运行时回退顺序：

1. 演员成功、导演成功且终检通过：展示导演版本。
2. 导演失败：对演员版本执行终检。
3. 演员版本通过：展示演员版本。
4. 演员版本未通过：使用角色、话题和回应模式对应的确定性兜底。
5. 演员失败：直接使用本轮回应模式对应的角色兜底。

最多执行两次模型调用，不进行无限重试。

当玩家离开聊天、换客、读档或开始新会话时，通过 AbortController 和 session/visit generation 取消演员与导演调用。旧结果不得写回新状态，这一部分同时关闭 LLM-002。

## 15. 质量测试体系

### 15.1 无模型单元测试

覆盖：

- 条件解析。
- 认知状态解析。
- 披露规则优先级。
- 好感度和剧情事件组合。
- 重复追问升级。
- 事实白名单。
- sealed 事实不进入演员上下文。
- 三位角色语言策略。
- 确定性终检。
- 角色兜底。

### 15.2 模拟模型集成测试

覆盖：

- 演员通过、导演通过。
- 导演改写。
- 导演超时后使用演员稿。
- 演员稿越界后使用角色兜底。
- 演员失败。
- 会话取消。
- 换客和读档竞态。
- 禁止状态修改字段。

### 15.3 真实模型质量评测

修复 devtools/npc-dialogue-quality-suite.mjs：

- 显式读取开发测试 Key 并通过 Authorization 发送，不记录 Key。
- 修复 requestPatch 被基础 transcript 覆盖的问题。
- 为用例增加状态快照、预期披露级别、禁止事实、允许事实和评分规则。
- 同一用例重复采样，而不是只运行一次。
- 输出每个角色、场景和指标的汇总。

三位核心角色分别覆盖：

- 低、中、高好感度。
- 剧情未开始、进行中、关键事实已揭露。
- 普通话题、私人话题、核心秘密。
- 直接追问、含蓄试探、错误前提、诱导剧透。
- 第一次、第二次和第三次重复追问。
- 调酒成功和失败。
- 连续多轮事实一致性。

每位核心角色至少定义 12 个真实模型场景，每个场景至少重复采样 5 次；首期验收样本不少于 180 条最终回复。硬性指标按全部样本计算，质量指标按角色和总体分别计算，任一核心角色未达标都不能以总体平均分掩盖。

### 15.4 人工演出验收

自动指标通过后，三位核心角色仍需逐场景人工验收，检查：

- 是否像角色本人。
- 是否有自然停顿和具体情绪。
- 拒答是否仍然有信息和游戏性。
- 同一状态多次生成是否机械重复。
- 状态变化后是否真的改变披露深度。

## 16. 验收标准

硬性指标：

- 锁定秘密泄露率：0%。
- 非法状态修改字段：0%。
- 角色认知冲突：0%。
- 最终输出结构成功率：100%。
- 会话竞态污染：0%。

质量指标：

- 人设一致性：至少 90%。
- 问题相关性：至少 90%。
- 角色化拒答：至少 90%。
- AI/客服腔命中率：低于 2%。

质量指标由确定性规则、导演违规码、真实模型重复采样和人工抽检共同评估，不能只依赖同一个模型自评。

人设一致性、问题相关性和角色化拒答采用固定评分量表，由评测程序记录模型评分，同时由项目所有者对每位角色随机抽取不少于 10 条进行人工复核。模型评分与人工复核冲突时，以人工复核为准并补充对应回归用例。

## 17. 调试与可观测性

开发模式的对话 Inspector 显示：

- 角色和会话 ID。
- 当前好感度与关系姿态。
- 命中的 topicId。
- cognition、disclosure level 和 responseMode。
- allowedFactIds、hintableFactIds 和 protectedTopicIds。
- 演员草稿。
- 导演 verdict 和 violation codes。
- 最终版本。
- 两次模型调用耗时和用量。
- 是否发生回退及原因。

Inspector 和日志不得包含：

- API Key。
- Authorization。
- 未解锁秘密的完整文本。
- 供应商原始敏感错误体。

## 18. 首期角色与兼容策略

完整配置：

- fox_uncle
- aqiang
- yuki

其他普通客人：

- 首期不编写完整秘密和多阶段披露策略。
- 使用简化、数据驱动的普通客人策略。
- 继续保持 AI 对话只读。
- 不继承“迷失者记忆模糊”或狐面大叔谜语式规则。

三位核心角色通过验收后，再按角色逐个迁移，不扩大首期范围。

## 19. 现有实现迁移

首期迁移必须完成：

1. 修正真实游戏请求读取错误或过弱的人设字段问题。
2. 对三位核心角色停止使用 promptBuilder.mjs 中的硬编码整段角色真相，改用 Canonical 清单和本轮上下文。
3. 将通用 Prompt 中“必须回答所有问题”和“允许回避秘密”的冲突规则替换为 responseMode。
4. 将 off_topic 从统一安全固定回复中拆出，交给角色化回拉策略。
5. 保留违法、露骨内容和提示注入的本地前置拦截，但改用角色专属确定性回应。
6. 更新 NpcDialogueRequest、相关测试、devtools 和文档；Express、Electron 和 Vercel 使用同一处理器。
7. 保留现有 replyLines、mood 和 endChat 前端演出契约，减少 UI 迁移范围。

## 20. 模型适配边界

首期继续使用 MiniMax-M2.5，不建设多模型接口基建。

为了不锁死后续选择：

- dialogue_policy、状态编译器、演员 Schema、导演 Schema 和终检不得引用 MiniMax 专属字段。
- MiniMax 请求格式、鉴权、错误码和 usage 映射继续留在 provider。
- 演员和导演业务层只依赖项目内部规范化输入输出。

后续独立任务再实现多供应商 adapter、模型配置档、演员/导演独立选模、玩家模型选择 UI 和多供应商 BYOK。

## 21. 实施与提交边界

实施按可独立验证的里程碑提交：

1. feat(dialogue): add state-driven disclosure policy
2. feat(dialogue): add actor-director quality pipeline
3. feat(dialogue): add core character performance policies
4. test(dialogue): add narrative quality gates
5. docs(dialogue): document character performance system

每个提交前运行对应的定向测试。最终提交前运行：

- npm run content:check
- npm run narrative:check
- npm run narrative:simulate
- npm test
- npm run lint
- npm run build

## 22. 已确认的设计决策

1. AI 对话只读主线状态。
2. 好感度影响披露意愿，不改变角色认知。
3. 角色化拒答是游戏演出，不是技术错误。
4. 使用演员生成和导演审校两次模型调用。
5. 质量优先于额外模型额度消耗。
6. 未解锁真相不进入演员 Prompt。
7. 首期完整支持狐面大叔、阿相和小雪。
8. 首期沿用 MiniMax，模型适配基建后置。
9. 大改动按可验证里程碑分别提交。
