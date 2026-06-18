const seniorRealWords = [
  {
    "word": "abandon",
    "phonetic": "/əˈbændən/",
    "meaning": "放弃，抛弃"
  },
  {
    "word": "absolute",
    "phonetic": "/ˈæbsəluːt/",
    "meaning": "绝对的"
  },
  {
    "word": "abstract",
    "phonetic": "/ˈæbstrækt/",
    "meaning": "抽象的"
  },
  {
    "word": "academic",
    "phonetic": "/ˌækəˈdemɪk/",
    "meaning": "学术的"
  },
  {
    "word": "accelerate",
    "phonetic": "/əkˈseləreɪt/",
    "meaning": "加速"
  },
  {
    "word": "accomplish",
    "phonetic": "/əˈkʌmplɪʃ/",
    "meaning": "完成"
  },
  {
    "word": "accurate",
    "phonetic": "/ˈækjərət/",
    "meaning": "准确的"
  },
  {
    "word": "accustomed",
    "phonetic": "/əˈkʌstəmd/",
    "meaning": "习惯的"
  },
  {
    "word": "acknowledge",
    "phonetic": "/əkˈnɒlɪdʒ/",
    "meaning": "承认"
  },
  {
    "word": "acquire",
    "phonetic": "/əˈkwaɪə(r)/",
    "meaning": "获得"
  },
  {
    "word": "adapt",
    "phonetic": "/əˈdæpt/",
    "meaning": "适应"
  },
  {
    "word": "adequate",
    "phonetic": "/ˈædɪkwət/",
    "meaning": "足够的"
  },
  {
    "word": "adjust",
    "phonetic": "/əˈdʒʌst/",
    "meaning": "调整"
  },
  {
    "word": "administration",
    "phonetic": "/ədˌmɪnɪˈstreɪʃn/",
    "meaning": "管理"
  },
  {
    "word": "adolescent",
    "phonetic": "/ˌædəˈlesnt/",
    "meaning": "青少年"
  },
  {
    "word": "adopt",
    "phonetic": "/əˈdɒpt/",
    "meaning": "采用"
  },
  {
    "word": "advance",
    "phonetic": "/ədˈvɑːns/",
    "meaning": "前进"
  },
  {
    "word": "advantageous",
    "phonetic": "/ˌædvənˈteɪdʒəs/",
    "meaning": "有利的"
  },
  {
    "word": "adventure",
    "phonetic": "/ədˈventʃə(r)/",
    "meaning": "冒险"
  },
  {
    "word": "advertise",
    "phonetic": "/ˈædvətaɪz/",
    "meaning": "广告"
  },
  {
    "word": "advocate",
    "phonetic": "/ˈædvəkeɪt/",
    "meaning": "提倡"
  },
  {
    "word": "affect",
    "phonetic": "/əˈfekt/",
    "meaning": "影响"
  },
  {
    "word": "affiliate",
    "phonetic": "/əˈfɪlieɪt/",
    "meaning": "附属"
  },
  {
    "word": "affirm",
    "phonetic": "/əˈfɜːm/",
    "meaning": "确认"
  },
  {
    "word": "affluent",
    "phonetic": "/ˈæfluənt/",
    "meaning": "富裕的"
  },
  {
    "word": "agency",
    "phonetic": "/ˈeɪdʒənsi/",
    "meaning": "机构"
  },
  {
    "word": "agenda",
    "phonetic": "/əˈdʒendə/",
    "meaning": "议程"
  },
  {
    "word": "agent",
    "phonetic": "/ˈeɪdʒənt/",
    "meaning": "代理人"
  },
  {
    "word": "aggregate",
    "phonetic": "/ˈæɡrɪɡət/",
    "meaning": "总计"
  },
  {
    "word": "aggressive",
    "phonetic": "/əˈɡresɪv/",
    "meaning": "侵略性的"
  },
  {
    "word": "agriculture",
    "phonetic": "/ˈæɡrɪkʌltʃə(r)/",
    "meaning": "农业"
  },
  {
    "word": "aid",
    "phonetic": "/eɪd/",
    "meaning": "援助"
  },
  {
    "word": "aircraft",
    "phonetic": "/ˈeəkrɑːft/",
    "meaning": "飞机"
  },
  {
    "word": "alarm",
    "phonetic": "/əˈlɑːm/",
    "meaning": "警报"
  },
  {
    "word": "album",
    "phonetic": "/ˈælbəm/",
    "meaning": "相册"
  },
  {
    "word": "alcohol",
    "phonetic": "/ˈælkəhɒl/",
    "meaning": "酒精"
  },
  {
    "word": "alert",
    "phonetic": "/əˈlɜːt/",
    "meaning": "警惕的"
  },
  {
    "word": "algebra",
    "phonetic": "/ˈældʒɪbrə/",
    "meaning": "代数"
  },
  {
    "word": "algorithm",
    "phonetic": "/ˈælɡərɪðəm/",
    "meaning": "算法"
  },
  {
    "word": "align",
    "phonetic": "/əˈlaɪn/",
    "meaning": "对齐"
  },
  {
    "word": "alike",
    "phonetic": "/əˈlaɪk/",
    "meaning": "相似的"
  },
  {
    "word": "alive",
    "phonetic": "/əˈlaɪv/",
    "meaning": "活着的"
  },
  {
    "word": "alliance",
    "phonetic": "/əˈlaɪəns/",
    "meaning": "联盟"
  },
  {
    "word": "allocate",
    "phonetic": "/ˈæləkeɪt/",
    "meaning": "分配"
  },
  {
    "word": "allowance",
    "phonetic": "/əˈlaʊəns/",
    "meaning": "津贴"
  },
  {
    "word": "ally",
    "phonetic": "/ˈælaɪ/",
    "meaning": "盟友"
  },
  {
    "word": "alter",
    "phonetic": "/ˈɔːltə(r)/",
    "meaning": "改变"
  },
  {
    "word": "alternative",
    "phonetic": "/ɔːlˈtɜːnətɪv/",
    "meaning": "替代的"
  },
  {
    "word": "altitude",
    "phonetic": "/ˈæltɪtjuːd/",
    "meaning": "高度"
  },
  {
    "word": "aluminum",
    "phonetic": "/əˈluːmɪnəm/",
    "meaning": "铝"
  },
  {
    "word": "amateur",
    "phonetic": "/ˈæmətə(r)/",
    "meaning": "业余的"
  },
  {
    "word": "amaze",
    "phonetic": "/əˈmeɪz/",
    "meaning": "使惊讶"
  },
  {
    "word": "ambassador",
    "phonetic": "/æmˈbæsədə(r)/",
    "meaning": "大使"
  },
  {
    "word": "ambient",
    "phonetic": "/ˈæmbiənt/",
    "meaning": "周围的"
  },
  {
    "word": "ambiguous",
    "phonetic": "/æmˈbɪɡjuəs/",
    "meaning": "模棱两可的"
  },
  {
    "word": "ambition",
    "phonetic": "/æmˈbɪʃn/",
    "meaning": "野心"
  },
  {
    "word": "ambulance",
    "phonetic": "/ˈæmbjələns/",
    "meaning": "救护车"
  },
  {
    "word": "amend",
    "phonetic": "/əˈmend/",
    "meaning": "修正"
  },
  {
    "word": "america",
    "phonetic": "/əˈmerɪkə/",
    "meaning": "美国"
  },
  {
    "word": "amiable",
    "phonetic": "/ˈeɪmiəbl/",
    "meaning": "和蔼可亲的"
  },
  {
    "word": "amnesia",
    "phonetic": "/æmˈniːziə/",
    "meaning": "健忘症"
  },
  {
    "word": "amount",
    "phonetic": "/əˈmaʊnt/",
    "meaning": "数量"
  },
  {
    "word": "ample",
    "phonetic": "/ˈæmpl/",
    "meaning": "充足的"
  },
  {
    "word": "amplify",
    "phonetic": "/ˈæmplɪfaɪ/",
    "meaning": "放大"
  },
  {
    "word": "amuse",
    "phonetic": "/əˈmjuːz/",
    "meaning": "使娱乐"
  },
  {
    "word": "analyze",
    "phonetic": "/ˈænəlaɪz/",
    "meaning": "分析"
  },
  {
    "word": "ancestor",
    "phonetic": "/ˈænsestə(r)/",
    "meaning": "祖先"
  },
  {
    "word": "anchor",
    "phonetic": "/ˈæŋkə(r)/",
    "meaning": "锚"
  },
  {
    "word": "ancient",
    "phonetic": "/ˈeɪnʃənt/",
    "meaning": "古代的"
  },
  {
    "word": "and",
    "phonetic": "/ænd/",
    "meaning": "和"
  },
  {
    "word": "anecdote",
    "phonetic": "/ˈænɪkdəʊt/",
    "meaning": "轶事"
  },
  {
    "word": "angel",
    "phonetic": "/ˈeɪndʒəl/",
    "meaning": "天使"
  },
  {
    "word": "anger",
    "phonetic": "/ˈæŋɡə(r)/",
    "meaning": "愤怒"
  },
  {
    "word": "angle",
    "phonetic": "/ˈæŋɡl/",
    "meaning": "角度"
  },
  {
    "word": "angry",
    "phonetic": "/ˈæŋɡri/",
    "meaning": "生气的"
  },
  {
    "word": "animal",
    "phonetic": "/ˈænɪml/",
    "meaning": "动物"
  },
  {
    "word": "ankle",
    "phonetic": "/ˈæŋkl/",
    "meaning": "脚踝"
  },
  {
    "word": "announce",
    "phonetic": "/əˈnaʊns/",
    "meaning": "宣布"
  },
  {
    "word": "annoy",
    "phonetic": "/əˈnɔɪ/",
    "meaning": "使烦恼"
  },
  {
    "word": "annual",
    "phonetic": "/ˈænjuəl/",
    "meaning": "年度的"
  },
  {
    "word": "anonymous",
    "phonetic": "/əˈnɒnɪməs/",
    "meaning": "匿名的"
  },
  {
    "word": "another",
    "phonetic": "/əˈnʌðə(r)/",
    "meaning": "另一个"
  },
  {
    "word": "answer",
    "phonetic": "/ˈɑːnsə(r)/",
    "meaning": "回答"
  },
  {
    "word": "anticipate",
    "phonetic": "/ænˈtɪsɪpeɪt/",
    "meaning": "预期"
  },
  {
    "word": "antique",
    "phonetic": "/ænˈtiːk/",
    "meaning": "古董"
  },
  {
    "word": "anxiety",
    "phonetic": "/æŋˈzaɪəti/",
    "meaning": "焦虑"
  },
  {
    "word": "any",
    "phonetic": "/ˈeni/",
    "meaning": "任何"
  },
  {
    "word": "anybody",
    "phonetic": "/ˈeniˌbɒdi/",
    "meaning": "任何人"
  },
  {
    "word": "anyhow",
    "phonetic": "/ˈenihaʊ/",
    "meaning": "无论如何"
  },
  {
    "word": "anyone",
    "phonetic": "/ˈeniwʌn/",
    "meaning": "任何人"
  },
  {
    "word": "anything",
    "phonetic": "/ˈeniθɪŋ/",
    "meaning": "任何事"
  },
  {
    "word": "anyway",
    "phonetic": "/ˈeniweɪ/",
    "meaning": "无论如何"
  },
  {
    "word": "anywhere",
    "phonetic": "/ˈeniweə(r)/",
    "meaning": "任何地方"
  },
  {
    "word": "apart",
    "phonetic": "/əˈpɑːt/",
    "meaning": "分开"
  },
  {
    "word": "apartment",
    "phonetic": "/əˈpɑːtmənt/",
    "meaning": "公寓"
  },
  {
    "word": "apologize",
    "phonetic": "/əˈpɒlədʒaɪz/",
    "meaning": "道歉"
  },
  {
    "word": "apology",
    "phonetic": "/əˈpɒlədʒi/",
    "meaning": "道歉"
  },
  {
    "word": "appear",
    "phonetic": "/əˈpɪə(r)/",
    "meaning": "出现"
  },
  {
    "word": "appearance",
    "phonetic": "/əˈpɪərəns/",
    "meaning": "外观"
  },
  {
    "word": "appendix",
    "phonetic": "/appendix/",
    "meaning": "附录"
  },
  {
    "word": "appetite",
    "phonetic": "/appetite/",
    "meaning": "食欲"
  },
  {
    "word": "applaud",
    "phonetic": "/applaud/",
    "meaning": "鼓掌"
  },
  {
    "word": "apple",
    "phonetic": "/apple/",
    "meaning": "苹果"
  },
  {
    "word": "application",
    "phonetic": "/application/",
    "meaning": "申请"
  },
  {
    "word": "apply",
    "phonetic": "/apply/",
    "meaning": "应用"
  },
  {
    "word": "appoint",
    "phonetic": "/appoint/",
    "meaning": "任命"
  },
  {
    "word": "appointment",
    "phonetic": "/appointment/",
    "meaning": "预约"
  },
  {
    "word": "appreciate",
    "phonetic": "/appreciate/",
    "meaning": "欣赏"
  },
  {
    "word": "approach",
    "phonetic": "/approach/",
    "meaning": "接近"
  },
  {
    "word": "appropriate",
    "phonetic": "/appropriate/",
    "meaning": "适当的"
  },
  {
    "word": "approval",
    "phonetic": "/approval/",
    "meaning": "批准"
  },
  {
    "word": "approve",
    "phonetic": "/approve/",
    "meaning": "批准"
  },
  {
    "word": "approximate",
    "phonetic": "/approximate/",
    "meaning": "近似的"
  },
  {
    "word": "approximately",
    "phonetic": "/approximately/",
    "meaning": "大约"
  },
  {
    "word": "April",
    "phonetic": "/April/",
    "meaning": "四月"
  },
  {
    "word": "Arab",
    "phonetic": "/Arab/",
    "meaning": "阿拉伯人"
  },
  {
    "word": "Arabia",
    "phonetic": "/Arabia/",
    "meaning": "阿拉伯"
  },
  {
    "word": "Arabic",
    "phonetic": "/Arabic/",
    "meaning": "阿拉伯语"
  },
  {
    "word": "arch",
    "phonetic": "/arch/",
    "meaning": "拱门"
  },
  {
    "word": "architect",
    "phonetic": "/architect/",
    "meaning": "建筑师"
  },
  {
    "word": "architecture",
    "phonetic": "/architecture/",
    "meaning": "建筑"
  },
  {
    "word": "area",
    "phonetic": "/area/",
    "meaning": "区域"
  },
  {
    "word": "argue",
    "phonetic": "/argue/",
    "meaning": "争论"
  },
  {
    "word": "argument",
    "phonetic": "/argument/",
    "meaning": "论点"
  },
  {
    "word": "arise",
    "phonetic": "/arise/",
    "meaning": "出现"
  },
  {
    "word": "arithmetic",
    "phonetic": "/arithmetic/",
    "meaning": "算术"
  },
  {
    "word": "arm",
    "phonetic": "/arm/",
    "meaning": "手臂"
  },
  {
    "word": "army",
    "phonetic": "/army/",
    "meaning": "军队"
  },
  {
    "word": "around",
    "phonetic": "/around/",
    "meaning": "周围"
  },
  {
    "word": "arrange",
    "phonetic": "/arrange/",
    "meaning": "安排"
  },
  {
    "word": "arrangement",
    "phonetic": "/arrangement/",
    "meaning": "安排"
  },
  {
    "word": "arrest",
    "phonetic": "/arrest/",
    "meaning": "逮捕"
  },
  {
    "word": "arrive",
    "phonetic": "/arrive/",
    "meaning": "到达"
  },
  {
    "word": "arrow",
    "phonetic": "/arrow/",
    "meaning": "箭"
  },
  {
    "word": "art",
    "phonetic": "/art/",
    "meaning": "艺术"
  },
  {
    "word": "article",
    "phonetic": "/article/",
    "meaning": "文章"
  },
  {
    "word": "artificial",
    "phonetic": "/artificial/",
    "meaning": "人工的"
  },
  {
    "word": "artist",
    "phonetic": "/artist/",
    "meaning": "艺术家"
  },
  {
    "word": "artistic",
    "phonetic": "/artistic/",
    "meaning": "艺术的"
  },
  {
    "word": "aspect",
    "phonetic": "/aspect/",
    "meaning": "方面"
  },
  {
    "word": "assemble",
    "phonetic": "/assemble/",
    "meaning": "组装"
  },
  {
    "word": "assembly",
    "phonetic": "/assembly/",
    "meaning": "集会"
  },
  {
    "word": "assert",
    "phonetic": "/assert/",
    "meaning": "断言"
  },
  {
    "word": "assess",
    "phonetic": "/assess/",
    "meaning": "评估"
  },
  {
    "word": "assessment",
    "phonetic": "/assessment/",
    "meaning": "评估"
  },
  {
    "word": "asset",
    "phonetic": "/asset/",
    "meaning": "资产"
  },
  {
    "word": "assign",
    "phonetic": "/assign/",
    "meaning": "分配"
  },
  {
    "word": "assignment",
    "phonetic": "/assignment/",
    "meaning": "作业"
  },
  {
    "word": "assist",
    "phonetic": "/assist/",
    "meaning": "帮助"
  },
  {
    "word": "assistance",
    "phonetic": "/assistance/",
    "meaning": "帮助"
  },
  {
    "word": "assistant",
    "phonetic": "/assistant/",
    "meaning": "助手"
  },
  {
    "word": "associate",
    "phonetic": "/associate/",
    "meaning": "联想"
  },
  {
    "word": "association",
    "phonetic": "/association/",
    "meaning": "协会"
  },
  {
    "word": "assume",
    "phonetic": "/assume/",
    "meaning": "假设"
  },
  {
    "word": "assumption",
    "phonetic": "/assumption/",
    "meaning": "假设"
  },
  {
    "word": "assure",
    "phonetic": "/assure/",
    "meaning": "保证"
  },
  {
    "word": "astonish",
    "phonetic": "/astonish/",
    "meaning": "惊讶"
  },
  {
    "word": "astound",
    "phonetic": "/astound/",
    "meaning": "震惊"
  },
  {
    "word": "astronaut",
    "phonetic": "/astronaut/",
    "meaning": "宇航员"
  },
  {
    "word": "astronomy",
    "phonetic": "/astronomy/",
    "meaning": "天文学"
  },
  {
    "word": "asylum",
    "phonetic": "/asylum/",
    "meaning": "庇护"
  },
  {
    "word": "at",
    "phonetic": "/at/",
    "meaning": "在"
  },
  {
    "word": "athlete",
    "phonetic": "/athlete/",
    "meaning": "运动员"
  },
  {
    "word": "athletic",
    "phonetic": "/athletic/",
    "meaning": "运动的"
  },
  {
    "word": "athletics",
    "phonetic": "/athletics/",
    "meaning": "体育"
  },
  {
    "word": "atmosphere",
    "phonetic": "/atmosphere/",
    "meaning": "大气"
  },
  {
    "word": "atom",
    "phonetic": "/atom/",
    "meaning": "原子"
  },
  {
    "word": "atomic",
    "phonetic": "/atomic/",
    "meaning": "原子的"
  },
  {
    "word": "attach",
    "phonetic": "/attach/",
    "meaning": "附加"
  },
  {
    "word": "attachment",
    "phonetic": "/attachment/",
    "meaning": "附件"
  },
  {
    "word": "attack",
    "phonetic": "/attack/",
    "meaning": "攻击"
  },
  {
    "word": "attain",
    "phonetic": "/attain/",
    "meaning": "达到"
  },
  {
    "word": "attempt",
    "phonetic": "/attempt/",
    "meaning": "尝试"
  },
  {
    "word": "attend",
    "phonetic": "/attend/",
    "meaning": "参加"
  },
  {
    "word": "attendance",
    "phonetic": "/attendance/",
    "meaning": "出席"
  },
  {
    "word": "attendant",
    "phonetic": "/attendant/",
    "meaning": "服务员"
  },
  {
    "word": "attention",
    "phonetic": "/attention/",
    "meaning": "注意"
  },
  {
    "word": "attentive",
    "phonetic": "/attentive/",
    "meaning": "专心的"
  },
  {
    "word": "attitude",
    "phonetic": "/attitude/",
    "meaning": "态度"
  },
  {
    "word": "attract",
    "phonetic": "/attract/",
    "meaning": "吸引"
  },
  {
    "word": "attraction",
    "phonetic": "/attraction/",
    "meaning": "吸引力"
  },
  {
    "word": "attractive",
    "phonetic": "/attractive/",
    "meaning": "有吸引力的"
  },
  {
    "word": "attribute",
    "phonetic": "/attribute/",
    "meaning": "属性"
  },
  {
    "word": "audience",
    "phonetic": "/audience/",
    "meaning": "观众"
  },
  {
    "word": "audio",
    "phonetic": "/audio/",
    "meaning": "音频"
  },
  {
    "word": "audit",
    "phonetic": "/audit/",
    "meaning": "审计"
  },
  {
    "word": "auditorium",
    "phonetic": "/auditorium/",
    "meaning": "礼堂"
  },
  {
    "word": "augment",
    "phonetic": "/augment/",
    "meaning": "增加"
  },
  {
    "word": "August",
    "phonetic": "/August/",
    "meaning": "八月"
  },
  {
    "word": "aunt",
    "phonetic": "/aunt/",
    "meaning": "阿姨"
  },
  {
    "word": "author",
    "phonetic": "/author/",
    "meaning": "作者"
  },
  {
    "word": "authority",
    "phonetic": "/authority/",
    "meaning": "权威"
  },
  {
    "word": "authorize",
    "phonetic": "/authorize/",
    "meaning": "授权"
  },
  {
    "word": "auto",
    "phonetic": "/auto/",
    "meaning": "汽车"
  },
  {
    "word": "autobiography",
    "phonetic": "/autobiography/",
    "meaning": "自传"
  },
  {
    "word": "autograph",
    "phonetic": "/autograph/",
    "meaning": "签名"
  },
  {
    "word": "automatic",
    "phonetic": "/automatic/",
    "meaning": "自动的"
  },
  {
    "word": "automation",
    "phonetic": "/automation/",
    "meaning": "自动化"
  },
  {
    "word": "automobile",
    "phonetic": "/automobile/",
    "meaning": "汽车"
  },
  {
    "word": "autonomy",
    "phonetic": "/autonomy/",
    "meaning": "自治"
  },
  {
    "word": "autumn",
    "phonetic": "/autumn/",
    "meaning": "秋天"
  },
  {
    "word": "available",
    "phonetic": "/available/",
    "meaning": "可获得的"
  },
  {
    "word": "avenue",
    "phonetic": "/avenue/",
    "meaning": "大道"
  },
  {
    "word": "average",
    "phonetic": "/average/",
    "meaning": "平均"
  },
  {
    "word": "avoid",
    "phonetic": "/avoid/",
    "meaning": "避免"
  },
  {
    "word": "await",
    "phonetic": "/await/",
    "meaning": "等待"
  },
  {
    "word": "awake",
    "phonetic": "/awake/",
    "meaning": "醒来"
  },
  {
    "word": "awaken",
    "phonetic": "/awaken/",
    "meaning": "唤醒"
  },
  {
    "word": "award",
    "phonetic": "/award/",
    "meaning": "奖励"
  },
  {
    "word": "aware",
    "phonetic": "/aware/",
    "meaning": "意识到的"
  },
  {
    "word": "awareness",
    "phonetic": "/awareness/",
    "meaning": "意识"
  },
  {
    "word": "away",
    "phonetic": "/away/",
    "meaning": "离开"
  },
  {
    "word": "awe",
    "phonetic": "/awe/",
    "meaning": "敬畏"
  },
  {
    "word": "awesome",
    "phonetic": "/awesome/",
    "meaning": "令人敬畏的"
  },
  {
    "word": "awful",
    "phonetic": "/awful/",
    "meaning": "可怕的"
  },
  {
    "word": "awkward",
    "phonetic": "/awkward/",
    "meaning": "尴尬的"
  },
  {
    "word": "axe",
    "phonetic": "/axe/",
    "meaning": "斧头"
  },
  {
    "word": "baby",
    "phonetic": "/baby/",
    "meaning": "婴儿"
  },
  {
    "word": "bachelor",
    "phonetic": "/bachelor/",
    "meaning": "单身汉"
  },
  {
    "word": "back",
    "phonetic": "/back/",
    "meaning": "后面"
  },
  {
    "word": "background",
    "phonetic": "/background/",
    "meaning": "背景"
  },
  {
    "word": "backward",
    "phonetic": "/backward/",
    "meaning": "向后"
  },
  {
    "word": "bacon",
    "phonetic": "/bacon/",
    "meaning": "培根"
  },
  {
    "word": "bacteria",
    "phonetic": "/bacteria/",
    "meaning": "细菌"
  },
  {
    "word": "bad",
    "phonetic": "/bad/",
    "meaning": "坏的"
  },
  {
    "word": "badge",
    "phonetic": "/badge/",
    "meaning": "徽章"
  },
  {
    "word": "badly",
    "phonetic": "/badly/",
    "meaning": "糟糕地"
  },
  {
    "word": "badminton",
    "phonetic": "/badminton/",
    "meaning": "羽毛球"
  },
  {
    "word": "bag",
    "phonetic": "/bag/",
    "meaning": "包"
  },
  {
    "word": "baggage",
    "phonetic": "/baggage/",
    "meaning": "行李"
  },
  {
    "word": "bait",
    "phonetic": "/bait/",
    "meaning": "诱饵"
  },
  {
    "word": "bake",
    "phonetic": "/bake/",
    "meaning": "烘焙"
  },
  {
    "word": "bakery",
    "phonetic": "/bakery/",
    "meaning": "面包店"
  },
  {
    "word": "balance",
    "phonetic": "/balance/",
    "meaning": "平衡"
  },
  {
    "word": "balcony",
    "phonetic": "/balcony/",
    "meaning": "阳台"
  },
  {
    "word": "bald",
    "phonetic": "/bald/",
    "meaning": "秃头的"
  },
  {
    "word": "ball",
    "phonetic": "/ball/",
    "meaning": "球"
  },
  {
    "word": "balloon",
    "phonetic": "/balloon/",
    "meaning": "气球"
  },
  {
    "word": "ballot",
    "phonetic": "/ballot/",
    "meaning": "投票"
  },
  {
    "word": "ban",
    "phonetic": "/ban/",
    "meaning": "禁止"
  },
  {
    "word": "banana",
    "phonetic": "/banana/",
    "meaning": "香蕉"
  },
  {
    "word": "band",
    "phonetic": "/band/",
    "meaning": "乐队"
  },
  {
    "word": "bandage",
    "phonetic": "/bandage/",
    "meaning": "绷带"
  },
  {
    "word": "bang",
    "phonetic": "/bang/",
    "meaning": "砰"
  },
  {
    "word": "bank",
    "phonetic": "/bank/",
    "meaning": "银行"
  },
  {
    "word": "bankrupt",
    "phonetic": "/bankrupt/",
    "meaning": "破产的"
  },
  {
    "word": "banner",
    "phonetic": "/banner/",
    "meaning": "横幅"
  },
  {
    "word": "bar",
    "phonetic": "/bar/",
    "meaning": "酒吧"
  },
  {
    "word": "barbecue",
    "phonetic": "/barbecue/",
    "meaning": "烧烤"
  },
  {
    "word": "barber",
    "phonetic": "/barber/",
    "meaning": "理发师"
  },
  {
    "word": "bare",
    "phonetic": "/bare/",
    "meaning": "裸露的"
  },
  {
    "word": "barely",
    "phonetic": "/barely/",
    "meaning": "几乎不"
  },
  {
    "word": "bargain",
    "phonetic": "/bargain/",
    "meaning": "讨价还价"
  },
  {
    "word": "bark",
    "phonetic": "/bark/",
    "meaning": "树皮"
  },
  {
    "word": "barrel",
    "phonetic": "/barrel/",
    "meaning": "桶"
  },
  {
    "word": "barrier",
    "phonetic": "/barrier/",
    "meaning": "障碍"
  },
  {
    "word": "base",
    "phonetic": "/base/",
    "meaning": "基础"
  },
  {
    "word": "baseball",
    "phonetic": "/baseball/",
    "meaning": "棒球"
  },
  {
    "word": "basement",
    "phonetic": "/basement/",
    "meaning": "地下室"
  },
  {
    "word": "basic",
    "phonetic": "/basic/",
    "meaning": "基本的"
  },
  {
    "word": "basically",
    "phonetic": "/basically/",
    "meaning": "基本上"
  },
  {
    "word": "basin",
    "phonetic": "/basin/",
    "meaning": "盆"
  },
  {
    "word": "basis",
    "phonetic": "/basis/",
    "meaning": "基础"
  },
  {
    "word": "basket",
    "phonetic": "/basket/",
    "meaning": "篮子"
  },
  {
    "word": "basketball",
    "phonetic": "/basketball/",
    "meaning": "篮球"
  },
  {
    "word": "bat",
    "phonetic": "/bat/",
    "meaning": "蝙蝠"
  },
  {
    "word": "batch",
    "phonetic": "/batch/",
    "meaning": "一批"
  },
  {
    "word": "bath",
    "phonetic": "/bath/",
    "meaning": "洗澡"
  },
  {
    "word": "bathe",
    "phonetic": "/bathe/",
    "meaning": "沐浴"
  },
  {
    "word": "bathroom",
    "phonetic": "/bathroom/",
    "meaning": "浴室"
  },
  {
    "word": "battery",
    "phonetic": "/battery/",
    "meaning": "电池"
  },
  {
    "word": "battle",
    "phonetic": "/battle/",
    "meaning": "战斗"
  },
  {
    "word": "bay",
    "phonetic": "/bay/",
    "meaning": "海湾"
  },
  {
    "word": "beach",
    "phonetic": "/beach/",
    "meaning": "海滩"
  },
  {
    "word": "beam",
    "phonetic": "/beam/",
    "meaning": "梁"
  },
  {
    "word": "bean",
    "phonetic": "/bean/",
    "meaning": "豆"
  },
  {
    "word": "bear",
    "phonetic": "/bear/",
    "meaning": "熊"
  },
  {
    "word": "beard",
    "phonetic": "/beard/",
    "meaning": "胡须"
  },
  {
    "word": "bearing",
    "phonetic": "/bearing/",
    "meaning": "举止"
  },
  {
    "word": "beast",
    "phonetic": "/beast/",
    "meaning": "野兽"
  },
  {
    "word": "beat",
    "phonetic": "/beat/",
    "meaning": "击打"
  },
  {
    "word": "beautiful",
    "phonetic": "/beautiful/",
    "meaning": "美丽的"
  },
  {
    "word": "beauty",
    "phonetic": "/beauty/",
    "meaning": "美丽"
  },
  {
    "word": "because",
    "phonetic": "/because/",
    "meaning": "因为"
  },
  {
    "word": "become",
    "phonetic": "/become/",
    "meaning": "变成"
  },
  {
    "word": "bed",
    "phonetic": "/bed/",
    "meaning": "床"
  },
  {
    "word": "bedroom",
    "phonetic": "/bedroom/",
    "meaning": "卧室"
  },
  {
    "word": "bee",
    "phonetic": "/bee/",
    "meaning": "蜜蜂"
  },
  {
    "word": "beef",
    "phonetic": "/beef/",
    "meaning": "牛肉"
  },
  {
    "word": "beer",
    "phonetic": "/beer/",
    "meaning": "啤酒"
  },
  {
    "word": "before",
    "phonetic": "/before/",
    "meaning": "在...之前"
  },
  {
    "word": "begin",
    "phonetic": "/begin/",
    "meaning": "开始"
  },
  {
    "word": "beginner",
    "phonetic": "/beginner/",
    "meaning": "初学者"
  },
  {
    "word": "beginning",
    "phonetic": "/beginning/",
    "meaning": "开始"
  },
  {
    "word": "behalf",
    "phonetic": "/behalf/",
    "meaning": "代表"
  },
  {
    "word": "behave",
    "phonetic": "/behave/",
    "meaning": "表现"
  },
  {
    "word": "behavio(u)r",
    "phonetic": "/behavior/",
    "meaning": "行为"
  },
  {
    "word": "behind",
    "phonetic": "/behind/",
    "meaning": "在...后面"
  },
  {
    "word": "being",
    "phonetic": "/being/",
    "meaning": "存在"
  },
  {
    "word": "belief",
    "phonetic": "/belief/",
    "meaning": "信仰"
  },
  {
    "word": "believe",
    "phonetic": "/believe/",
    "meaning": "相信"
  },
  {
    "word": "bell",
    "phonetic": "/bell/",
    "meaning": "铃铛"
  },
  {
    "word": "belly",
    "phonetic": "/belly/",
    "meaning": "肚子"
  },
  {
    "word": "belong",
    "phonetic": "/belong/",
    "meaning": "属于"
  },
  {
    "word": "beloved",
    "phonetic": "/beloved/",
    "meaning": "亲爱的"
  },
  {
    "word": "below",
    "phonetic": "/below/",
    "meaning": "在...下面"
  },
  {
    "word": "belt",
    "phonetic": "/belt/",
    "meaning": "腰带"
  },
  {
    "word": "bench",
    "phonetic": "/bench/",
    "meaning": "长凳"
  },
  {
    "word": "bend",
    "phonetic": "/bend/",
    "meaning": "弯曲"
  },
  {
    "word": "beneath",
    "phonetic": "/beneath/",
    "meaning": "在...下方"
  },
  {
    "word": "beneficial",
    "phonetic": "/beneficial/",
    "meaning": "有益的"
  },
  {
    "word": "benefit",
    "phonetic": "/benefit/",
    "meaning": "益处"
  },
  {
    "word": "benevolent",
    "phonetic": "/benevolent/",
    "meaning": "仁慈的"
  },
  {
    "word": "bent",
    "phonetic": "/bent/",
    "meaning": "弯曲的"
  },
  {
    "word": "berry",
    "phonetic": "/berry/",
    "meaning": "浆果"
  },
  {
    "word": "beside",
    "phonetic": "/beside/",
    "meaning": "在...旁边"
  },
  {
    "word": "besides",
    "phonetic": "/besides/",
    "meaning": "此外"
  },
  {
    "word": "best",
    "phonetic": "/best/",
    "meaning": "最好的"
  },
  {
    "word": "bet",
    "phonetic": "/bet/",
    "meaning": "打赌"
  },
  {
    "word": "betray",
    "phonetic": "/betray/",
    "meaning": "背叛"
  },
  {
    "word": "better",
    "phonetic": "/better/",
    "meaning": "更好的"
  },
  {
    "word": "between",
    "phonetic": "/between/",
    "meaning": "在...之间"
  },
  {
    "word": "beyond",
    "phonetic": "/beyond/",
    "meaning": "超越"
  },
  {
    "word": "Bible",
    "phonetic": "/Bible/",
    "meaning": "圣经"
  },
  {
    "word": "bicycle",
    "phonetic": "/bicycle/",
    "meaning": "自行车"
  },
  {
    "word": "bid",
    "phonetic": "/bid/",
    "meaning": "投标"
  },
  {
    "word": "big",
    "phonetic": "/big/",
    "meaning": "大的"
  },
  {
    "word": "bike",
    "phonetic": "/baik/",
    "meaning": "自行车"
  },
  {
    "word": "bill",
    "phonetic": "/bil/",
    "meaning": "账单"
  },
  {
    "word": "billion",
    "phonetic": "/biljən/",
    "meaning": "十亿"
  },
  {
    "word": "bind",
    "phonetic": "/baind/",
    "meaning": "绑定"
  },
  {
    "word": "biography",
    "phonetic": "/bai'ɔɡrəfi/",
    "meaning": "传记"
  },
  {
    "word": "biology",
    "phonetic": "/bai'ɔlədʒi/",
    "meaning": "生物学"
  },
  {
    "word": "bird",
    "phonetic": "/bə:d/",
    "meaning": "鸟"
  },
  {
    "word": "birth",
    "phonetic": "/bə:θ/",
    "meaning": "出生"
  },
  {
    "word": "birthday",
    "phonetic": "/'bə:θdei/",
    "meaning": "生日"
  },
  {
    "word": "birthplace",
    "phonetic": "/'bə:θpleis/",
    "meaning": "出生地"
  },
  {
    "word": "bishop",
    "phonetic": "/'biʃəp/",
    "meaning": "主教"
  },
  {
    "word": "bit",
    "phonetic": "/bit/",
    "meaning": "一点"
  },
  {
    "word": "bite",
    "phonetic": "/bait/",
    "meaning": "咬"
  },
  {
    "word": "bitter",
    "phonetic": "/'bitə/",
    "meaning": "苦的"
  },
  {
    "word": "bitterly",
    "phonetic": "/'bitəli/",
    "meaning": "痛苦地"
  },
  {
    "word": "black",
    "phonetic": "/blæk/",
    "meaning": "黑色"
  },
  {
    "word": "blackboard",
    "phonetic": "/'blækbɔ:d/",
    "meaning": "黑板"
  },
  {
    "word": "blame",
    "phonetic": "/bleim/",
    "meaning": "责备"
  },
  {
    "word": "blank",
    "phonetic": "/blæŋk/",
    "meaning": "空白"
  },
  {
    "word": "blanket",
    "phonetic": "/'blæŋkit/",
    "meaning": "毯子"
  },
  {
    "word": "blast",
    "phonetic": "/blɑ:st/",
    "meaning": "爆炸"
  },
  {
    "word": "blaze",
    "phonetic": "/bleiz/",
    "meaning": "火焰"
  },
  {
    "word": "bleak",
    "phonetic": "/bli:k/",
    "meaning": "荒凉的"
  },
  {
    "word": "bleed",
    "phonetic": "/bli:d/",
    "meaning": "流血"
  },
  {
    "word": "bless",
    "phonetic": "/bles/",
    "meaning": "祝福"
  },
  {
    "word": "blind",
    "phonetic": "/blaind/",
    "meaning": "盲的"
  },
  {
    "word": "block",
    "phonetic": "/blɔk/",
    "meaning": "街区"
  },
  {
    "word": "blonde",
    "phonetic": "/blɔnd/",
    "meaning": "金色的"
  },
  {
    "word": "blood",
    "phonetic": "/blʌd/",
    "meaning": "血液"
  },
  {
    "word": "bloody",
    "phonetic": "/'blʌdi/",
    "meaning": "血腥的"
  },
  {
    "word": "blossom",
    "phonetic": "/'blɔsəm/",
    "meaning": "开花"
  },
  {
    "word": "blow",
    "phonetic": "/bləu/",
    "meaning": "吹"
  },
  {
    "word": "blue",
    "phonetic": "/blu:/",
    "meaning": "蓝色"
  },
  {
    "word": "blues",
    "phonetic": "/blu:z/",
    "meaning": "布鲁斯音乐"
  },
  {
    "word": "blur",
    "phonetic": "/blə:/",
    "meaning": "模糊"
  },
  {
    "word": "blush",
    "phonetic": "/blʌʃ/",
    "meaning": "脸红"
  },
  {
    "word": "board",
    "phonetic": "/bɔ:d/",
    "meaning": "木板"
  },
  {
    "word": "boat",
    "phonetic": "/bəut/",
    "meaning": "船"
  },
  {
    "word": "body",
    "phonetic": "/'bɔdi/",
    "meaning": "身体"
  },
  {
    "word": "boil",
    "phonetic": "/bɔil/",
    "meaning": "煮沸"
  },
  {
    "word": "boiler",
    "phonetic": "/'bɔilə/",
    "meaning": "锅炉"
  },
  {
    "word": "bold",
    "phonetic": "/bəuld/",
    "meaning": "大胆的"
  },
  {
    "word": "bomb",
    "phonetic": "/bɔm/",
    "meaning": "炸弹"
  },
  {
    "word": "bond",
    "phonetic": "/bɔnd/",
    "meaning": "债券"
  },
  {
    "word": "bone",
    "phonetic": "/bəun/",
    "meaning": "骨头"
  },
  {
    "word": "bonus",
    "phonetic": "/'bəunəs/",
    "meaning": "奖金"
  },
  {
    "word": "book",
    "phonetic": "/buk/",
    "meaning": "书"
  },
  {
    "word": "bookcase",
    "phonetic": "/'bukkeis/",
    "meaning": "书柜"
  },
  {
    "word": "bookmark",
    "phonetic": "/'bukmɑ:k/",
    "meaning": "书签"
  },
  {
    "word": "bookshelf",
    "phonetic": "/'bukʃelf/",
    "meaning": "书架"
  },
  {
    "word": "bookshop",
    "phonetic": "/'bukʃɔp/",
    "meaning": "书店"
  },
  {
    "word": "bookstore",
    "phonetic": "/'bukstɔ:/",
    "meaning": "书店"
  },
  {
    "word": "boom",
    "phonetic": "/bu:m/",
    "meaning": "繁荣"
  },
  {
    "word": "boot",
    "phonetic": "/bu:t/",
    "meaning": "靴子"
  },
  {
    "word": "booth",
    "phonetic": "/bu:ð/",
    "meaning": "摊位"
  },
  {
    "word": "border",
    "phonetic": "/'bɔ:də/",
    "meaning": "边界"
  },
  {
    "word": "bore",
    "phonetic": "/bɔ:/",
    "meaning": "使厌烦"
  },
  {
    "word": "boring",
    "phonetic": "/'bɔ:riŋ/",
    "meaning": "无聊的"
  },
  {
    "word": "born",
    "phonetic": "/bɔ:n/",
    "meaning": "出生的"
  },
  {
    "word": "borrow",
    "phonetic": "/'bɔrəu/",
    "meaning": "借"
  },
  {
    "word": "boss",
    "phonetic": "/bɔs/",
    "meaning": "老板"
  },
  {
    "word": "both",
    "phonetic": "/bəuθ/",
    "meaning": "两者"
  },
  {
    "word": "bother",
    "phonetic": "/'bɔðə/",
    "meaning": "打扰"
  },
  {
    "word": "bottle",
    "phonetic": "/'bɔtl/",
    "meaning": "瓶子"
  },
  {
    "word": "bottom",
    "phonetic": "/'bɔtəm/",
    "meaning": "底部"
  },
  {
    "word": "bound",
    "phonetic": "/baund/",
    "meaning": "必定的"
  },
  {
    "word": "boundary",
    "phonetic": "/'baundəri/",
    "meaning": "边界"
  },
  {
    "word": "bow",
    "phonetic": "/bau/",
    "meaning": "鞠躬"
  },
  {
    "word": "bowl",
    "phonetic": "/bəul/",
    "meaning": "碗"
  },
  {
    "word": "box",
    "phonetic": "/bɔks/",
    "meaning": "盒子"
  },
  {
    "word": "boy",
    "phonetic": "/bɔi/",
    "meaning": "男孩"
  },
  {
    "word": "boyhood",
    "phonetic": "/'bɔihud/",
    "meaning": "童年"
  },
  {
    "word": "brain",
    "phonetic": "/brein/",
    "meaning": "大脑"
  },
  {
    "word": "brake",
    "phonetic": "/breik/",
    "meaning": "刹车"
  },
  {
    "word": "branch",
    "phonetic": "/brɑ:ntʃ/",
    "meaning": "分支"
  },
  {
    "word": "brand",
    "phonetic": "/brænd/",
    "meaning": "品牌"
  },
  {
    "word": "brass",
    "phonetic": "/bræs/",
    "meaning": "黄铜"
  },
  {
    "word": "brave",
    "phonetic": "/breiv/",
    "meaning": "勇敢的"
  },
  {
    "word": "bread",
    "phonetic": "/bred/",
    "meaning": "面包"
  },
  {
    "word": "break",
    "phonetic": "/breik/",
    "meaning": "打破"
  },
  {
    "word": "breakfast",
    "phonetic": "/'brekfəst/",
    "meaning": "早餐"
  },
  {
    "word": "breakthrough",
    "phonetic": "/'breikθru:/",
    "meaning": "突破"
  },
  {
    "word": "breast",
    "phonetic": "/brest/",
    "meaning": "胸部"
  },
  {
    "word": "breath",
    "phonetic": "/breθ/",
    "meaning": "呼吸"
  },
  {
    "word": "breathe",
    "phonetic": "/bri:ð/",
    "meaning": "呼吸"
  },
  {
    "word": "breed",
    "phonetic": "/bri:d/",
    "meaning": "繁殖"
  },
  {
    "word": "breeze",
    "phonetic": "/bri:z/",
    "meaning": "微风"
  },
  {
    "word": "brick",
    "phonetic": "/brik/",
    "meaning": "砖"
  },
  {
    "word": "bride",
    "phonetic": "/braid/",
    "meaning": "新娘"
  },
  {
    "word": "bridegroom",
    "phonetic": "/'braidɡru:m/",
    "meaning": "新郎"
  },
  {
    "word": "bridge",
    "phonetic": "/bridʒ/",
    "meaning": "桥"
  },
  {
    "word": "brief",
    "phonetic": "/bri:f/",
    "meaning": "简短的"
  },
  {
    "word": "briefcase",
    "phonetic": "/'bri:fkeis/",
    "meaning": "公文包"
  },
  {
    "word": "bright",
    "phonetic": "/brait/",
    "meaning": "明亮的"
  },
  {
    "word": "brilliant",
    "phonetic": "/'briljənt/",
    "meaning": "杰出的"
  },
  {
    "word": "brim",
    "phonetic": "/brim/",
    "meaning": "边缘"
  },
  {
    "word": "bring",
    "phonetic": "/briŋ/",
    "meaning": "带来"
  },
  {
    "word": "brink",
    "phonetic": "/briŋk/",
    "meaning": "边缘"
  },
  {
    "word": "brisk",
    "phonetic": "/brisk/",
    "meaning": "轻快的"
  },
  {
    "word": "bristle",
    "phonetic": "/'brisl/",
    "meaning": "硬毛"
  },
  {
    "word": "britain",
    "phonetic": "/'britn/",
    "meaning": "英国"
  },
  {
    "word": "british",
    "phonetic": "/'britiʃ/",
    "meaning": "英国的"
  },
  {
    "word": "broad",
    "phonetic": "/brɔ:d/",
    "meaning": "宽的"
  },
  {
    "word": "broadcast",
    "phonetic": "/'brɔ:dkɑ:st/",
    "meaning": "广播"
  },
  {
    "word": "brochure",
    "phonetic": "/brəu'ʃuə/",
    "meaning": "小册子"
  },
  {
    "word": "broken",
    "phonetic": "/'brəukən/",
    "meaning": "破碎的"
  },
  {
    "word": "bronze",
    "phonetic": "/brɔnz/",
    "meaning": "青铜"
  },
  {
    "word": "brood",
    "phonetic": "/bru:d/",
    "meaning": "一窝"
  },
  {
    "word": "brook",
    "phonetic": "/bruk/",
    "meaning": "小溪"
  },
  {
    "word": "broom",
    "phonetic": "/bru:m/",
    "meaning": "扫帚"
  },
  {
    "word": "brother",
    "phonetic": "/'brʌðə/",
    "meaning": "兄弟"
  },
  {
    "word": "brow",
    "phonetic": "/brau/",
    "meaning": "眉毛"
  },
  {
    "word": "brown",
    "phonetic": "/braun/",
    "meaning": "棕色"
  },
  {
    "word": "brush",
    "phonetic": "/brʌʃ/",
    "meaning": "刷子"
  },
  {
    "word": "brutal",
    "phonetic": "/'bru:tl/",
    "meaning": "残忍的"
  },
  {
    "word": "bubble",
    "phonetic": "/'bʌbl/",
    "meaning": "气泡"
  },
  {
    "word": "bucket",
    "phonetic": "/'bʌkit/",
    "meaning": "桶"
  },
  {
    "word": "bud",
    "phonetic": "/bʌd/",
    "meaning": "芽"
  },
  {
    "word": "buddha",
    "phonetic": "/'budə/",
    "meaning": "佛"
  },
  {
    "word": "budget",
    "phonetic": "/'bʌdʒit/",
    "meaning": "预算"
  },
  {
    "word": "buffalo",
    "phonetic": "/'bʌfələu/",
    "meaning": "水牛"
  },
  {
    "word": "buffer",
    "phonetic": "/'bʌfə/",
    "meaning": "缓冲"
  },
  {
    "word": "bug",
    "phonetic": "/bʌɡ/",
    "meaning": "虫子"
  },
  {
    "word": "build",
    "phonetic": "/bild/",
    "meaning": "建造"
  },
  {
    "word": "builder",
    "phonetic": "/'bildə/",
    "meaning": "建筑工人"
  },
  {
    "word": "building",
    "phonetic": "/'bildiŋ/",
    "meaning": "建筑物"
  },
  {
    "word": "bulb",
    "phonetic": "/bʌlb/",
    "meaning": "灯泡"
  },
  {
    "word": "bulk",
    "phonetic": "/bʌlk/",
    "meaning": "体积"
  },
  {
    "word": "bull",
    "phonetic": "/bul/",
    "meaning": "公牛"
  },
  {
    "word": "bullet",
    "phonetic": "/'bulit/",
    "meaning": "子弹"
  },
  {
    "word": "bulletin",
    "phonetic": "/'bulitin/",
    "meaning": "公告"
  },
  {
    "word": "bullshit",
    "phonetic": "/'bulʃit/",
    "meaning": "胡说"
  },
  {
    "word": "bully",
    "phonetic": "/'buli/",
    "meaning": "欺凌"
  },
  {
    "word": "bump",
    "phonetic": "/bʌmp/",
    "meaning": "碰撞"
  },
  {
    "word": "bunch",
    "phonetic": "/bʌntʃ/",
    "meaning": "一束"
  },
  {
    "word": "bundle",
    "phonetic": "/'bʌndl/",
    "meaning": "捆绑"
  },
  {
    "word": "bungalow",
    "phonetic": "/'bʌŋɡələu/",
    "meaning": "平房"
  },
  {
    "word": "bunk",
    "phonetic": "/bʌŋk/",
    "meaning": "铺位"
  },
  {
    "word": "bunker",
    "phonetic": "/'bʌŋkə/",
    "meaning": "地堡"
  },
  {
    "word": "burden",
    "phonetic": "/'bə:dən/",
    "meaning": "负担"
  },
  {
    "word": "bureau",
    "phonetic": "/'bjuərəu/",
    "meaning": "局"
  },
  {
    "word": "bureaucracy",
    "phonetic": "/bjuə'rɔkrəsi/",
    "meaning": "官僚"
  },
  {
    "word": "burglar",
    "phonetic": "/'bə:ɡlə/",
    "meaning": "窃贼"
  },
  {
    "word": "burn",
    "phonetic": "/bə:n/",
    "meaning": "燃烧"
  },
  {
    "word": "burning",
    "phonetic": "/'bə:niŋ/",
    "meaning": "燃烧的"
  },
  {
    "word": "burst",
    "phonetic": "/bə:st/",
    "meaning": "爆发"
  },
  {
    "word": "bury",
    "phonetic": "/'beri/",
    "meaning": "埋葬"
  },
  {
    "word": "bus",
    "phonetic": "/bʌs/",
    "meaning": "公共汽车"
  },
  {
    "word": "bush",
    "phonetic": "/buʃ/",
    "meaning": "灌木"
  },
  {
    "word": "business",
    "phonetic": "/'biznis/",
    "meaning": "商业"
  },
  {
    "word": "businessman",
    "phonetic": "/'biznismæn/",
    "meaning": "商人"
  },
  {
    "word": "businesswoman",
    "phonetic": "/'bizniswumən/",
    "meaning": "女商人"
  },
  {
    "word": "busy",
    "phonetic": "/'bizi/",
    "meaning": "忙碌的"
  },
  {
    "word": "but",
    "phonetic": "/bʌt/",
    "meaning": "但是"
  },
  {
    "word": "butcher",
    "phonetic": "/'butʃə/",
    "meaning": "屠夫"
  },
  {
    "word": "butter",
    "phonetic": "/'bʌtə/",
    "meaning": "黄油"
  },
  {
    "word": "button",
    "phonetic": "/'bʌtn/",
    "meaning": "按钮"
  },
  {
    "word": "buy",
    "phonetic": "/bai/",
    "meaning": "购买"
  },
  {
    "word": "buzz",
    "phonetic": "/bʌz/",
    "meaning": "嗡嗡声"
  },
  {
    "word": "bye",
    "phonetic": "/bai/",
    "meaning": "再见"
  },
  {
    "word": "cabbage",
    "phonetic": "/'kæbidʒ/",
    "meaning": "卷心菜"
  },
  {
    "word": "cabin",
    "phonetic": "/'kæbin/",
    "meaning": "小屋"
  },
  {
    "word": "cabinet",
    "phonetic": "/'kæbinit/",
    "meaning": "橱柜"
  },
  {
    "word": "cable",
    "phonetic": "/'keibl/",
    "meaning": "电缆"
  },
  {
    "word": "cafe",
    "phonetic": "/'kæfei/",
    "meaning": "咖啡馆"
  },
  {
    "word": "cafeteria",
    "phonetic": "/kæfi'tiəriə/",
    "meaning": "自助餐厅"
  },
  {
    "word": "cage",
    "phonetic": "/keidʒ/",
    "meaning": "笼子"
  },
  {
    "word": "cake",
    "phonetic": "/keik/",
    "meaning": "蛋糕"
  },
  {
    "word": "calculate",
    "phonetic": "/'kælkjuleit/",
    "meaning": "计算"
  },
  {
    "word": "calculator",
    "phonetic": "/'kælkjuleitə/",
    "meaning": "计算器"
  },
  {
    "word": "calculus",
    "phonetic": "/'kælkjuləs/",
    "meaning": "微积分"
  },
  {
    "word": "calendar",
    "phonetic": "/'kælində/",
    "meaning": "日历"
  },
  {
    "word": "call",
    "phonetic": "/kɔ:l/",
    "meaning": "呼叫"
  },
  {
    "word": "calm",
    "phonetic": "/kɑ:m/",
    "meaning": "平静的"
  },
  {
    "word": "camel",
    "phonetic": "/'kæməl/",
    "meaning": "骆驼"
  },
  {
    "word": "camera",
    "phonetic": "/'kæmərə/",
    "meaning": "相机"
  },
  {
    "word": "camp",
    "phonetic": "/kæmp/",
    "meaning": "营地"
  },
  {
    "word": "campaign",
    "phonetic": "/kæm'pein/",
    "meaning": "运动"
  },
  {
    "word": "campus",
    "phonetic": "/'kæmpəs/",
    "meaning": "校园"
  },
  {
    "word": "can",
    "phonetic": "/kæn/",
    "meaning": "能够"
  },
  {
    "word": "canal",
    "phonetic": "/kə'næl/",
    "meaning": "运河"
  },
  {
    "word": "cancel",
    "phonetic": "/'kænsəl/",
    "meaning": "取消"
  },
  {
    "word": "cancer",
    "phonetic": "/'kænsə/",
    "meaning": "癌症"
  },
  {
    "word": "candidate",
    "phonetic": "/'kændideit/",
    "meaning": "候选人"
  },
  {
    "word": "candle",
    "phonetic": "/'kændl/",
    "meaning": "蜡烛"
  },
  {
    "word": "candy",
    "phonetic": "/'kændi/",
    "meaning": "糖果"
  },
  {
    "word": "cannon",
    "phonetic": "/'kænən/",
    "meaning": "大炮"
  },
  {
    "word": "canoe",
    "phonetic": "/kə'nu:/",
    "meaning": "独木舟"
  },
  {
    "word": "canteen",
    "phonetic": "/kæn'ti:n/",
    "meaning": "食堂"
  },
  {
    "word": "canvas",
    "phonetic": "/'kænvəs/",
    "meaning": "帆布"
  },
  {
    "word": "cap",
    "phonetic": "/kæp/",
    "meaning": "帽子"
  },
  {
    "word": "capable",
    "phonetic": "/'keipəbl/",
    "meaning": "有能力的"
  },
  {
    "word": "capacity",
    "phonetic": "/kə'pæsiti/",
    "meaning": "容量"
  },
  {
    "word": "capital",
    "phonetic": "/'kæpitəl/",
    "meaning": "首都"
  },
  {
    "word": "captain",
    "phonetic": "/'kæptin/",
    "meaning": "船长"
  },
  {
    "word": "caption",
    "phonetic": "/'kæpʃən/",
    "meaning": "标题"
  },
  {
    "word": "car",
    "phonetic": "/kɑ:/",
    "meaning": "汽车"
  },
  {
    "word": "carbon",
    "phonetic": "/'kɑ:bən/",
    "meaning": "碳"
  },
  {
    "word": "card",
    "phonetic": "/kɑ:d/",
    "meaning": "卡片"
  },
  {
    "word": "cardboard",
    "phonetic": "/'kɑ:dbɔ:d/",
    "meaning": "硬纸板"
  },
  {
    "word": "cardigan",
    "phonetic": "/'kɑ:diɡən/",
    "meaning": "开衫"
  },
  {
    "word": "care",
    "phonetic": "/kɛə/",
    "meaning": "关心"
  },
  {
    "word": "career",
    "phonetic": "/kə'riə/",
    "meaning": "职业"
  },
  {
    "word": "careful",
    "phonetic": "/'kɛəful/",
    "meaning": "小心的"
  },
  {
    "word": "careless",
    "phonetic": "/'kɛəlis/",
    "meaning": "粗心的"
  },
  {
    "word": "cargo",
    "phonetic": "/'kɑ:ɡəu/",
    "meaning": "货物"
  },
  {
    "word": "carpenter",
    "phonetic": "/'kɑ:pintə/",
    "meaning": "木匠"
  },
  {
    "word": "carpet",
    "phonetic": "/'kɑ:pit/",
    "meaning": "地毯"
  },
  {
    "word": "carriage",
    "phonetic": "/'kæridʒ/",
    "meaning": "马车"
  },
  {
    "word": "carry",
    "phonetic": "/'kæri/",
    "meaning": "携带"
  },
  {
    "word": "cart",
    "phonetic": "/kɑ:t/",
    "meaning": "手推车"
  },
  {
    "word": "carve",
    "phonetic": "/kɑ:v/",
    "meaning": "雕刻"
  },
  {
    "word": "case",
    "phonetic": "/keis/",
    "meaning": "情况"
  },
  {
    "word": "cash",
    "phonetic": "/kæʃ/",
    "meaning": "现金"
  },
  {
    "word": "cassette",
    "phonetic": "/kə'set/",
    "meaning": "磁带"
  },
  {
    "word": "cast",
    "phonetic": "/kɑ:st/",
    "meaning": "投掷"
  },
  {
    "word": "castle",
    "phonetic": "/'kɑ:sl/",
    "meaning": "城堡"
  },
  {
    "word": "casual",
    "phonetic": "/'kæʒjuəl/",
    "meaning": "休闲的"
  },
  {
    "word": "casualty",
    "phonetic": "/'kæʒjuəlti/",
    "meaning": "伤亡"
  },
  {
    "word": "cat",
    "phonetic": "/kæt/",
    "meaning": "猫"
  },
  {
    "word": "catalog",
    "phonetic": "/'kætəlɔɡ/",
    "meaning": "目录"
  },
  {
    "word": "catastrophe",
    "phonetic": "/kə'tæstrəfi/",
    "meaning": "灾难"
  },
  {
    "word": "catch",
    "phonetic": "/kætʃ/",
    "meaning": "抓住"
  },
  {
    "word": "category",
    "phonetic": "/'kætəɡəri/",
    "meaning": "类别"
  },
  {
    "word": "cater",
    "phonetic": "/'keitə/",
    "meaning": "迎合"
  },
  {
    "word": "cathedral",
    "phonetic": "/kə'θi:drəl/",
    "meaning": "大教堂"
  },
  {
    "word": "cattle",
    "phonetic": "/'kætl/",
    "meaning": "牛"
  },
  {
    "word": "cause",
    "phonetic": "/kɔ:z/",
    "meaning": "原因"
  },
  {
    "word": "caution",
    "phonetic": "/'kɔ:ʃən/",
    "meaning": "谨慎"
  },
  {
    "word": "cautious",
    "phonetic": "/'kɔ:ʃəs/",
    "meaning": "谨慎的"
  },
  {
    "word": "cave",
    "phonetic": "/keiv/",
    "meaning": "洞穴"
  },
  {
    "word": "caveat",
    "phonetic": "/'kæviæt/",
    "meaning": "警告"
  },
  {
    "word": "ceiling",
    "phonetic": "/'si:liŋ/",
    "meaning": "天花板"
  },
  {
    "word": "celebrate",
    "phonetic": "/'selibreit/",
    "meaning": "庆祝"
  },
  {
    "word": "celebration",
    "phonetic": "[ˌselɪˈbreɪʃn]",
    "meaning": "庆祝"
  },
  {
    "word": "cell",
    "phonetic": "[sel]",
    "meaning": "细胞"
  },
  {
    "word": "cellar",
    "phonetic": "[ˈselə(r)]",
    "meaning": "地下室"
  },
  {
    "word": "cement",
    "phonetic": "[səˈment]",
    "meaning": "水泥"
  },
  {
    "word": "cemetery",
    "phonetic": "[ˈsemətri]",
    "meaning": "墓地"
  },
  {
    "word": "census",
    "phonetic": "[ˈsensəs]",
    "meaning": "人口普查"
  },
  {
    "word": "central",
    "phonetic": "[ˈsentrəl]",
    "meaning": "中心的"
  },
  {
    "word": "centigrade",
    "phonetic": "[ˈsentɪɡreɪd]",
    "meaning": "摄氏度"
  },
  {
    "word": "centimeter",
    "phonetic": "[ˈsentɪmiːtə(r)]",
    "meaning": "厘米"
  },
  {
    "word": "centralize",
    "phonetic": "[ˈsentrəlaɪz]",
    "meaning": "集中"
  },
  {
    "word": "century",
    "phonetic": "[ˈsentʃəri]",
    "meaning": "世纪"
  },
  {
    "word": "ceramic",
    "phonetic": "[səˈræmɪk]",
    "meaning": "陶瓷的"
  },
  {
    "word": "cereal",
    "phonetic": "[ˈsɪəriəl]",
    "meaning": "谷物"
  },
  {
    "word": "ceremony",
    "phonetic": "[ˈserəməni]",
    "meaning": "仪式"
  },
  {
    "word": "certain",
    "phonetic": "[ˈsɜːtn]",
    "meaning": "确定的"
  },
  {
    "word": "certainty",
    "phonetic": "[ˈsɜːtnti]",
    "meaning": "确定性"
  },
  {
    "word": "certificate",
    "phonetic": "[səˈtɪfɪkət]",
    "meaning": "证书"
  },
  {
    "word": "certify",
    "phonetic": "[ˈsɜːtɪfaɪ]",
    "meaning": "证明"
  },
  {
    "word": "chain",
    "phonetic": "[tʃeɪn]",
    "meaning": "链条"
  },
  {
    "word": "chair",
    "phonetic": "[tʃeə(r)]",
    "meaning": "椅子"
  },
  {
    "word": "chairman",
    "phonetic": "[ˈtʃeəmən]",
    "meaning": "主席"
  },
  {
    "word": "chalk",
    "phonetic": "[tʃɔːk]",
    "meaning": "粉笔"
  },
  {
    "word": "challenge",
    "phonetic": "[ˈtʃælɪndʒ]",
    "meaning": "挑战"
  },
  {
    "word": "chamber",
    "phonetic": "[ˈtʃeɪmbə(r)]",
    "meaning": "房间"
  },
  {
    "word": "champion",
    "phonetic": "[ˈtʃæmpiən]",
    "meaning": "冠军"
  },
  {
    "word": "chance",
    "phonetic": "[tʃɑːns]",
    "meaning": "机会"
  },
  {
    "word": "change",
    "phonetic": "[tʃeɪndʒ]",
    "meaning": "改变"
  },
  {
    "word": "channel",
    "phonetic": "[ˈtʃænl]",
    "meaning": "频道"
  },
  {
    "word": "chaos",
    "phonetic": "[ˈkeɪɒs]",
    "meaning": "混乱"
  },
  {
    "word": "chapter",
    "phonetic": "[ˈtʃæptə(r)]",
    "meaning": "章节"
  },
  {
    "word": "character",
    "phonetic": "[ˈkærəktə(r)]",
    "meaning": "性格"
  },
  {
    "word": "characteristic",
    "phonetic": "[ˌkærəktəˈrɪstɪk]",
    "meaning": "特征"
  },
  {
    "word": "charge",
    "phonetic": "[tʃɑːdʒ]",
    "meaning": "收费"
  },
  {
    "word": "charity",
    "phonetic": "[ˈtʃærəti]",
    "meaning": "慈善"
  },
  {
    "word": "charm",
    "phonetic": "[tʃɑːm]",
    "meaning": "魅力"
  },
  {
    "word": "chart",
    "phonetic": "[tʃɑːt]",
    "meaning": "图表"
  },
  {
    "word": "chase",
    "phonetic": "[tʃeɪs]",
    "meaning": "追逐"
  },
  {
    "word": "chat",
    "phonetic": "[tʃæt]",
    "meaning": "聊天"
  },
  {
    "word": "cheap",
    "phonetic": "[tʃiːp]",
    "meaning": "便宜的"
  },
  {
    "word": "cheat",
    "phonetic": "[tʃiːt]",
    "meaning": "欺骗"
  },
  {
    "word": "check",
    "phonetic": "[tʃek]",
    "meaning": "检查"
  },
  {
    "word": "cheek",
    "phonetic": "[tʃiːk]",
    "meaning": "脸颊"
  },
  {
    "word": "cheer",
    "phonetic": "[tʃɪə(r)]",
    "meaning": "欢呼"
  },
  {
    "word": "cheerful",
    "phonetic": "[ˈtʃɪəfl]",
    "meaning": "快乐的"
  },
  {
    "word": "cheese",
    "phonetic": "[tʃiːz]",
    "meaning": "奶酪"
  },
  {
    "word": "chemical",
    "phonetic": "[ˈkemɪkl]",
    "meaning": "化学的"
  },
  {
    "word": "chemist",
    "phonetic": "[ˈkemɪst]",
    "meaning": "化学家"
  },
  {
    "word": "chemistry",
    "phonetic": "[ˈkemɪstri]",
    "meaning": "化学"
  },
  {
    "word": "cheque",
    "phonetic": "[tʃek]",
    "meaning": "支票"
  },
  {
    "word": "cherish",
    "phonetic": "[ˈtʃerɪʃ]",
    "meaning": "珍惜"
  },
  {
    "word": "cherry",
    "phonetic": "[ˈtʃeri]",
    "meaning": "樱桃"
  },
  {
    "word": "chess",
    "phonetic": "[tʃes]",
    "meaning": "国际象棋"
  },
  {
    "word": "chest",
    "phonetic": "[tʃest]",
    "meaning": "胸部"
  },
  {
    "word": "chew",
    "phonetic": "[tʃuː]",
    "meaning": "咀嚼"
  },
  {
    "word": "chicken",
    "phonetic": "[ˈtʃɪkɪn]",
    "meaning": "鸡肉"
  },
  {
    "word": "chief",
    "phonetic": "[tʃiːf]",
    "meaning": "首领"
  },
  {
    "word": "child",
    "phonetic": "[tʃaɪld]",
    "meaning": "孩子"
  },
  {
    "word": "childhood",
    "phonetic": "[ˈtʃaɪldhʊd]",
    "meaning": "童年"
  },
  {
    "word": "childish",
    "phonetic": "[ˈtʃaɪldɪʃ]",
    "meaning": "孩子气的"
  },
  {
    "word": "chill",
    "phonetic": "[tʃɪl]",
    "meaning": "寒冷"
  },
  {
    "word": "chimney",
    "phonetic": "[ˈtʃɪmni]",
    "meaning": "烟囱"
  },
  {
    "word": "chin",
    "phonetic": "[tʃɪn]",
    "meaning": "下巴"
  },
  {
    "word": "china",
    "phonetic": "[ˈtʃaɪnə]",
    "meaning": "瓷器"
  },
  {
    "word": "Chinese",
    "phonetic": "[ˌtʃaɪˈniːz]",
    "meaning": "中国的"
  },
  {
    "word": "chocolate",
    "phonetic": "[ˈtʃɒklət]",
    "meaning": "巧克力"
  },
  {
    "word": "choice",
    "phonetic": "[tʃɔɪs]",
    "meaning": "选择"
  },
  {
    "word": "choke",
    "phonetic": "[tʃəʊk]",
    "meaning": "窒息"
  },
  {
    "word": "choose",
    "phonetic": "[tʃuːz]",
    "meaning": "选择"
  },
  {
    "word": "chop",
    "phonetic": "[tʃɒp]",
    "meaning": "砍"
  },
  {
    "word": "chopsticks",
    "phonetic": "[ˈtʃɒpstɪks]",
    "meaning": "筷子"
  },
  {
    "word": "Christian",
    "phonetic": "[ˈkrɪstʃən]",
    "meaning": "基督教徒"
  },
  {
    "word": "Christmas",
    "phonetic": "[ˈkrɪsməs]",
    "meaning": "圣诞节"
  },
  {
    "word": "church",
    "phonetic": "[tʃɜːtʃ]",
    "meaning": "教堂"
  },
  {
    "word": "cigar",
    "phonetic": "[sɪˈɡɑː(r)]",
    "meaning": "雪茄"
  },
  {
    "word": "cigarette",
    "phonetic": "[ˌsɪɡəˈret]",
    "meaning": "香烟"
  },
  {
    "word": "cinema",
    "phonetic": "[ˈsɪnəmə]",
    "meaning": "电影院"
  },
  {
    "word": "circle",
    "phonetic": "[ˈsɜːkl]",
    "meaning": "圆"
  },
  {
    "word": "circuit",
    "phonetic": "[ˈsɜːkɪt]",
    "meaning": "电路"
  },
  {
    "word": "circulate",
    "phonetic": "[ˈsɜːkjəleɪt]",
    "meaning": "循环"
  },
  {
    "word": "circulation",
    "phonetic": "[ˌsɜːkjəˈleɪʃn]",
    "meaning": "循环"
  },
  {
    "word": "circumstance",
    "phonetic": "[ˈsɜːkəmstəns]",
    "meaning": "情况"
  },
  {
    "word": "circus",
    "phonetic": "[ˈsɜːkəs]",
    "meaning": "马戏团"
  },
  {
    "word": "cite",
    "phonetic": "[saɪt]",
    "meaning": "引用"
  },
  {
    "word": "citizen",
    "phonetic": "[ˈsɪtɪzn]",
    "meaning": "公民"
  },
  {
    "word": "city",
    "phonetic": "[ˈsɪti]",
    "meaning": "城市"
  },
  {
    "word": "civil",
    "phonetic": "[ˈsɪvl]",
    "meaning": "公民的"
  },
  {
    "word": "civilization",
    "phonetic": "[ˌsɪvəlaɪˈzeɪʃn]",
    "meaning": "文明"
  },
  {
    "word": "civilize",
    "phonetic": "[ˈsɪvəlaɪz]",
    "meaning": "使文明"
  },
  {
    "word": "claim",
    "phonetic": "[kleɪm]",
    "meaning": "声称"
  },
  {
    "word": "clap",
    "phonetic": "[klæp]",
    "meaning": "拍手"
  },
  {
    "word": "clarify",
    "phonetic": "[ˈklærəfaɪ]",
    "meaning": "澄清"
  },
  {
    "word": "clarity",
    "phonetic": "[ˈklærəti]",
    "meaning": "清晰"
  },
  {
    "word": "clash",
    "phonetic": "[klæʃ]",
    "meaning": "冲突"
  },
  {
    "word": "class",
    "phonetic": "[klɑːs]",
    "meaning": "班级"
  },
  {
    "word": "classic",
    "phonetic": "[ˈklæsɪk]",
    "meaning": "经典的"
  },
  {
    "word": "classical",
    "phonetic": "[ˈklæsɪkl]",
    "meaning": "古典的"
  },
  {
    "word": "classification",
    "phonetic": "[ˌklæsɪfɪˈkeɪʃn]",
    "meaning": "分类"
  },
  {
    "word": "classify",
    "phonetic": "[ˈklæsɪfaɪ]",
    "meaning": "分类"
  },
  {
    "word": "classmate",
    "phonetic": "[ˈklɑːsmeɪt]",
    "meaning": "同学"
  },
  {
    "word": "classroom",
    "phonetic": "[ˈklɑːsruːm]",
    "meaning": "教室"
  },
  {
    "word": "clause",
    "phonetic": "[klɔːz]",
    "meaning": "条款"
  },
  {
    "word": "clean",
    "phonetic": "[kliːn]",
    "meaning": "干净的"
  },
  {
    "word": "clear",
    "phonetic": "[klɪə(r)]",
    "meaning": "清晰的"
  },
  {
    "word": "clerk",
    "phonetic": "[klɑːk]",
    "meaning": "职员"
  },
  {
    "word": "clever",
    "phonetic": "[ˈklevə(r)]",
    "meaning": "聪明的"
  },
  {
    "word": "cliff",
    "phonetic": "[klɪf]",
    "meaning": "悬崖"
  },
  {
    "word": "climate",
    "phonetic": "[ˈklaɪmət]",
    "meaning": "气候"
  },
  {
    "word": "climb",
    "phonetic": "[klaɪm]",
    "meaning": "攀爬"
  },
  {
    "word": "clinic",
    "phonetic": "[ˈklɪnɪk]",
    "meaning": "诊所"
  },
  {
    "word": "clinical",
    "phonetic": "[ˈklɪnɪkl]",
    "meaning": "临床的"
  },
  {
    "word": "clip",
    "phonetic": "[klɪp]",
    "meaning": "回形针"
  },
  {
    "word": "clock",
    "phonetic": "[klɒk]",
    "meaning": "时钟"
  },
  {
    "word": "clone",
    "phonetic": "[kləʊn]",
    "meaning": "克隆"
  },
  {
    "word": "close",
    "phonetic": "[kləʊz]",
    "meaning": "关闭"
  },
  {
    "word": "closet",
    "phonetic": "[ˈklɒzɪt]",
    "meaning": "衣橱"
  },
  {
    "word": "cloth",
    "phonetic": "[klɒθ]",
    "meaning": "布"
  },
  {
    "word": "clothes",
    "phonetic": "[kləʊðz]",
    "meaning": "衣服"
  },
  {
    "word": "clothing",
    "phonetic": "[ˈkləʊðɪŋ]",
    "meaning": "服装"
  },
  {
    "word": "cloud",
    "phonetic": "[klaʊd]",
    "meaning": "云"
  },
  {
    "word": "cloudy",
    "phonetic": "[ˈklaʊdi]",
    "meaning": "多云的"
  },
  {
    "word": "club",
    "phonetic": "[klʌb]",
    "meaning": "俱乐部"
  },
  {
    "word": "clue",
    "phonetic": "[kluː]",
    "meaning": "线索"
  },
  {
    "word": "clumsy",
    "phonetic": "[ˈklʌmzi]",
    "meaning": "笨拙的"
  },
  {
    "word": "coach",
    "phonetic": "[kəʊtʃ]",
    "meaning": "教练"
  },
  {
    "word": "coal",
    "phonetic": "[kəʊl]",
    "meaning": "煤"
  },
  {
    "word": "coast",
    "phonetic": "[kəʊst]",
    "meaning": "海岸"
  },
  {
    "word": "coat",
    "phonetic": "[kəʊt]",
    "meaning": "外套"
  },
  {
    "word": "code",
    "phonetic": "[kəʊd]",
    "meaning": "代码"
  },
  {
    "word": "coffee",
    "phonetic": "[ˈkɒfi]",
    "meaning": "咖啡"
  },
  {
    "word": "cognitive",
    "phonetic": "[ˈkɒɡnətɪv]",
    "meaning": "认知的"
  },
  {
    "word": "cogwheel",
    "phonetic": "[ˈkɒɡwiːl]",
    "meaning": "齿轮"
  },
  {
    "word": "coin",
    "phonetic": "[kɔɪn]",
    "meaning": "硬币"
  },
  {
    "word": "coincidence",
    "phonetic": "[kəʊˈɪnsɪdəns]",
    "meaning": "巧合"
  },
  {
    "word": "cold",
    "phonetic": "[kəʊld]",
    "meaning": "寒冷的"
  },
  {
    "word": "collar",
    "phonetic": "[ˈkɒlə(r)]",
    "meaning": "衣领"
  },
  {
    "word": "collapse",
    "phonetic": "[kəˈlæps]",
    "meaning": "倒塌"
  },
  {
    "word": "colleague",
    "phonetic": "[ˈkɒliːɡ]",
    "meaning": "同事"
  },
  {
    "word": "collect",
    "phonetic": "[kəˈlekt]",
    "meaning": "收集"
  },
  {
    "word": "collection",
    "phonetic": "[kəˈlekʃn]",
    "meaning": "收集"
  },
  {
    "word": "collective",
    "phonetic": "[kəˈlektɪv]",
    "meaning": "集体的"
  },
  {
    "word": "college",
    "phonetic": "[ˈkɒlɪdʒ]",
    "meaning": "大学"
  },
  {
    "word": "collision",
    "phonetic": "[kəˈlɪʒn]",
    "meaning": "碰撞"
  },
  {
    "word": "colonial",
    "phonetic": "[kəˈləʊniəl]",
    "meaning": "殖民的"
  },
  {
    "word": "colony",
    "phonetic": "[ˈkɒləni]",
    "meaning": "殖民地"
  },
  {
    "word": "color",
    "phonetic": "[ˈkʌlə(r)]",
    "meaning": "颜色"
  },
  {
    "word": "column",
    "phonetic": "[ˈkɒləm]",
    "meaning": "列"
  },
  {
    "word": "comb",
    "phonetic": "[kəʊm]",
    "meaning": "梳子"
  },
  {
    "word": "combat",
    "phonetic": "[ˈkɒmbæt]",
    "meaning": "战斗"
  },
  {
    "word": "combination",
    "phonetic": "[ˌkɒmbɪˈneɪʃn]",
    "meaning": "结合"
  },
  {
    "word": "combine",
    "phonetic": "[kəmˈbaɪn]",
    "meaning": "结合"
  },
  {
    "word": "come",
    "phonetic": "[kʌm]",
    "meaning": "来"
  },
  {
    "word": "comedy",
    "phonetic": "[ˈkɒmədi]",
    "meaning": "喜剧"
  },
  {
    "word": "comfort",
    "phonetic": "[ˈkʌmfət]",
    "meaning": "舒适"
  },
  {
    "word": "comfortable",
    "phonetic": "[ˈkʌmftəbl]",
    "meaning": "舒适的"
  },
  {
    "word": "command",
    "phonetic": "[kəˈmɑːnd]",
    "meaning": "命令"
  },
  {
    "word": "commander",
    "phonetic": "[kəˈmɑːndə(r)]",
    "meaning": "指挥官"
  },
  {
    "word": "comment",
    "phonetic": "[ˈkɒment]",
    "meaning": "评论"
  },
  {
    "word": "commerce",
    "phonetic": "[ˈkɒmɜːs]",
    "meaning": "商业"
  },
  {
    "word": "commercial",
    "phonetic": "[kəˈmɜːʃl]",
    "meaning": "商业的"
  },
  {
    "word": "commission",
    "phonetic": "[kəˈmɪʃn]",
    "meaning": "委员会"
  },
  {
    "word": "commit",
    "phonetic": "[kəˈmɪt]",
    "meaning": "承诺"
  },
  {
    "word": "committee",
    "phonetic": "[kəˈmɪti]",
    "meaning": "委员会"
  },
  {
    "word": "common",
    "phonetic": "[ˈkɒmən]",
    "meaning": "常见的"
  },
  {
    "word": "communicate",
    "phonetic": "[kəˈmjuːnɪkeɪt]",
    "meaning": "交流"
  },
  {
    "word": "communication",
    "phonetic": "[kəˌmjuːnɪˈkeɪʃn]",
    "meaning": "通信"
  },
  {
    "word": "communism",
    "phonetic": "[ˈkɒmjunɪzəm]",
    "meaning": "共产主义"
  },
  {
    "word": "communist",
    "phonetic": "[ˈkɒmjunɪst]",
    "meaning": "共产主义者"
  },
  {
    "word": "community",
    "phonetic": "[kəˈmjuːnəti]",
    "meaning": "社区"
  },
  {
    "word": "companion",
    "phonetic": "[kəmˈpæniən]",
    "meaning": "同伴"
  },
  {
    "word": "company",
    "phonetic": "[ˈkʌmpəni]",
    "meaning": "公司"
  },
  {
    "word": "compare",
    "phonetic": "[kəmˈpeə(r)]",
    "meaning": "比较"
  },
  {
    "word": "comparison",
    "phonetic": "[kəmˈpærɪsn]",
    "meaning": "比较"
  },
  {
    "word": "compatible",
    "phonetic": "[kəmˈpætəbl]",
    "meaning": "兼容的"
  },
  {
    "word": "compel",
    "phonetic": "[kəmˈpel]",
    "meaning": "强迫"
  },
  {
    "word": "compensate",
    "phonetic": "[ˈkɒmpenseɪt]",
    "meaning": "补偿"
  },
  {
    "word": "compensation",
    "phonetic": "[ˌkɒmpenˈseɪʃn]",
    "meaning": "补偿"
  },
  {
    "word": "compete",
    "phonetic": "[kəmˈpiːt]",
    "meaning": "竞争"
  },
  {
    "word": "competent",
    "phonetic": "[ˈkɒmpɪtənt]",
    "meaning": "有能力的"
  },
  {
    "word": "competition",
    "phonetic": "[ˌkɒmpəˈtɪʃn]",
    "meaning": "竞争"
  },
  {
    "word": "competitor",
    "phonetic": "[kəmˈpetɪtə(r)]",
    "meaning": "竞争者"
  },
  {
    "word": "compile",
    "phonetic": "[kəmˈpaɪl]",
    "meaning": "编译"
  },
  {
    "word": "complain",
    "phonetic": "[kəmˈpleɪn]",
    "meaning": "抱怨"
  },
  {
    "word": "complaint",
    "phonetic": "[kəmˈpleɪnt]",
    "meaning": "抱怨"
  },
  {
    "word": "complete",
    "phonetic": "[kəmˈpliːt]",
    "meaning": "完成"
  },
  {
    "word": "completely",
    "phonetic": "[kəmˈpliːtli]",
    "meaning": "完全地"
  },
  {
    "word": "complex",
    "phonetic": "[ˈkɒmpleks]",
    "meaning": "复杂的"
  },
  {
    "word": "complexity",
    "phonetic": "[kəmˈpleksəti]",
    "meaning": "复杂性"
  },
  {
    "word": "complicate",
    "phonetic": "[ˈkɒmplɪkeɪt]",
    "meaning": "使复杂"
  },
  {
    "word": "complicated",
    "phonetic": "[ˈkɒmplɪkeɪtɪd]",
    "meaning": "复杂的"
  },
  {
    "word": "component",
    "phonetic": "[kəmˈpəʊnənt]",
    "meaning": "组件"
  },
  {
    "word": "compose",
    "phonetic": "[kəmˈpəʊz]",
    "meaning": "组成"
  },
  {
    "word": "composition",
    "phonetic": "[ˌkɒmpəˈzɪʃn]",
    "meaning": "作文"
  },
  {
    "word": "compound",
    "phonetic": "[ˈkɒmpaʊnd]",
    "meaning": "化合物"
  },
  {
    "word": "comprehend",
    "phonetic": "[ˌkɒmprɪˈhend]",
    "meaning": "理解"
  },
  {
    "word": "comprehension",
    "phonetic": "[ˌkɒmprɪˈhenʃn]",
    "meaning": "理解"
  },
  {
    "word": "comprehensive",
    "phonetic": "[ˌkɒmprɪˈhensɪv]",
    "meaning": "全面的"
  },
  {
    "word": "compress",
    "phonetic": "[kəmˈpres]",
    "meaning": "压缩"
  },
  {
    "word": "compression",
    "phonetic": "[kəmˈpreʃn]",
    "meaning": "压缩"
  },
  {
    "word": "comprise",
    "phonetic": "[kəmˈpraɪz]",
    "meaning": "包含"
  },
  {
    "word": "compromise",
    "phonetic": "[ˈkɒmprəmaɪz]",
    "meaning": "妥协"
  },
  {
    "word": "compulsory",
    "phonetic": "[kəmˈpʌlsəri]",
    "meaning": "义务的"
  },
  {
    "word": "compute",
    "phonetic": "[kəmˈpjuːt]",
    "meaning": "计算"
  },
  {
    "word": "computer",
    "phonetic": "[kəmˈpjuːtə(r)]",
    "meaning": "电脑"
  },
  {
    "word": "comrade",
    "phonetic": "[ˈkɒmreɪd]",
    "meaning": "同志"
  },
  {
    "word": "conceal",
    "phonetic": "[kənˈsiːl]",
    "meaning": "隐藏"
  },
  {
    "word": "concede",
    "phonetic": "[kənˈsiːd]",
    "meaning": "承认"
  },
  {
    "word": "concentrate",
    "phonetic": "[ˈkɒnsntreɪt]",
    "meaning": "集中"
  },
  {
    "word": "concentration",
    "phonetic": "[ˌkɒnsnˈtreɪʃn]",
    "meaning": "浓度"
  },
  {
    "word": "concept",
    "phonetic": "[ˈkɒnsept]",
    "meaning": "概念"
  },
  {
    "word": "conception",
    "phonetic": "[kənˈsepʃn]",
    "meaning": "概念"
  },
  {
    "word": "concern",
    "phonetic": "[kənˈsɜːn]",
    "meaning": "关心"
  },
  {
    "word": "concert",
    "phonetic": "[ˈkɒnsət]",
    "meaning": "音乐会"
  },
  {
    "word": "concession",
    "phonetic": "[kənˈseʃn]",
    "meaning": "让步"
  },
  {
    "word": "concise",
    "phonetic": "[kənˈsaɪs]",
    "meaning": "简洁的"
  },
  {
    "word": "conclude",
    "phonetic": "[kənˈkluːd]",
    "meaning": "总结"
  },
  {
    "word": "conclusion",
    "phonetic": "[kənˈkluːʒn]",
    "meaning": "结论"
  },
  {
    "word": "concrete",
    "phonetic": "[ˈkɒŋkriːt]",
    "meaning": "具体的"
  },
  {
    "word": "condemn",
    "phonetic": "[kənˈdem]",
    "meaning": "谴责"
  },
  {
    "word": "condense",
    "phonetic": "[kənˈdens]",
    "meaning": "浓缩"
  },
  {
    "word": "condition",
    "phonetic": "[kənˈdɪʃn]",
    "meaning": "条件"
  },
  {
    "word": "conduct",
    "phonetic": "[kənˈdʌkt]",
    "meaning": "行为"
  },
  {
    "word": "conductor",
    "phonetic": "[kənˈdʌktə(r)]",
    "meaning": "导体"
  },
  {
    "word": "confident",
    "phonetic": "[ˈkɒnfɪdənt]",
    "meaning": "自信的"
  },
  {
    "word": "confidence",
    "phonetic": "[ˈkɒnfɪdəns]",
    "meaning": "信心"
  },
  {
    "word": "confidential",
    "phonetic": "[ˌkɒnfɪˈdenʃl]",
    "meaning": "机密的"
  },
  {
    "word": "confine",
    "phonetic": "[kənˈfaɪn]",
    "meaning": "限制"
  },
  {
    "word": "confirm",
    "phonetic": "[kənˈfɜːm]",
    "meaning": "确认"
  },
  {
    "word": "conflict",
    "phonetic": "[ˈkɒnflɪkt]",
    "meaning": "冲突"
  },
  {
    "word": "conform",
    "phonetic": "[kənˈfɔːm]",
    "meaning": "遵守"
  },
  {
    "word": "confuse",
    "phonetic": "[kənˈfjuːz]",
    "meaning": "混淆"
  },
  {
    "word": "confusion",
    "phonetic": "[kənˈfjuːʒn]",
    "meaning": "混乱"
  },
  {
    "word": "congratulate",
    "phonetic": "[kənˈɡrætʃuleɪt]",
    "meaning": "祝贺"
  },
  {
    "word": "congratulation",
    "phonetic": "[kənˌɡrætʃuˈleɪʃn]",
    "meaning": "祝贺"
  },
  {
    "word": "connect",
    "phonetic": "[kəˈnekt]",
    "meaning": "连接"
  },
  {
    "word": "connection",
    "phonetic": "[kəˈnekʃn]",
    "meaning": "连接"
  },
  {
    "word": "conscience",
    "phonetic": "[ˈkɒnʃəns]",
    "meaning": "良心"
  },
  {
    "word": "conscious",
    "phonetic": "[ˈkɒnʃəs]",
    "meaning": "意识到的"
  },
  {
    "word": "consensus",
    "phonetic": "[kənˈsensəs]",
    "meaning": "共识"
  },
  {
    "word": "consequence",
    "phonetic": "[ˈkɒnsɪkwəns]",
    "meaning": "后果"
  },
  {
    "word": "consequent",
    "phonetic": "[ˈkɒnsɪkwənt]",
    "meaning": "随之发生的"
  },
  {
    "word": "consequently",
    "phonetic": "[ˈkɒnsɪkwəntli]",
    "meaning": "因此"
  },
  {
    "word": "conservation",
    "phonetic": "[ˌkɒnsəˈveɪʃn]",
    "meaning": "保护"
  },
  {
    "word": "conservative",
    "phonetic": "[kənˈsɜːvətɪv]",
    "meaning": "保守的"
  },
  {
    "word": "consider",
    "phonetic": "[kənˈsɪdə(r)]",
    "meaning": "考虑"
  },
  {
    "word": "considerable",
    "phonetic": "[kənˈsɪdərəbl]",
    "meaning": "相当大的"
  },
  {
    "word": "considerate",
    "phonetic": "[kənˈsɪdərət]",
    "meaning": "体贴的"
  },
  {
    "word": "consideration",
    "phonetic": "[kənˌsɪdəˈreɪʃn]",
    "meaning": "考虑"
  },
  {
    "word": "consist",
    "phonetic": "[kənˈsɪst]",
    "meaning": "组成"
  },
  {
    "word": "consistent",
    "phonetic": "[kənˈsɪstənt]",
    "meaning": "一致的"
  },
  {
    "word": "consistency",
    "phonetic": "[kənˈsɪstənsi]",
    "meaning": "一致性"
  },
  {
    "word": "console",
    "phonetic": "[kənˈsəʊl]",
    "meaning": "安慰"
  },
  {
    "word": "consolidate",
    "phonetic": "[kənˈsɒlɪdeɪt]",
    "meaning": "巩固"
  },
  {
    "word": "conspiracy",
    "phonetic": "[kənˈspɪrəsi]",
    "meaning": "阴谋"
  },
  {
    "word": "constant",
    "phonetic": "[ˈkɒnstənt]",
    "meaning": "不断的"
  },
  {
    "word": "constantly",
    "phonetic": "[ˈkɒnstəntli]",
    "meaning": "不断地"
  },
  {
    "word": "constitution",
    "phonetic": "[ˌkɒnstɪˈtjuːʃn]",
    "meaning": "宪法"
  },
  {
    "word": "construct",
    "phonetic": "[kənˈstrʌkt]",
    "meaning": "建造"
  },
  {
    "word": "construction",
    "phonetic": "[kənˈstrʌkʃn]",
    "meaning": "建筑"
  },
  {
    "word": "consult",
    "phonetic": "[kənˈsʌlt]",
    "meaning": "咨询"
  },
  {
    "word": "consultant",
    "phonetic": "[kənˈsʌltənt]",
    "meaning": "顾问"
  },
  {
    "word": "consume",
    "phonetic": "[kənˈsjuːm]",
    "meaning": "消费"
  },
  {
    "word": "consumer",
    "phonetic": "[kənˈsjuːmə(r)]",
    "meaning": "消费者"
  },
  {
    "word": "consumption",
    "phonetic": "[kənˈsʌmpʃn]",
    "meaning": "消费"
  },
  {
    "word": "contact",
    "phonetic": "[ˈkɒntækt]",
    "meaning": "接触"
  },
  {
    "word": "contain",
    "phonetic": "[kənˈteɪn]",
    "meaning": "包含"
  },
  {
    "word": "container",
    "phonetic": "[kənˈteɪnə(r)]",
    "meaning": "容器"
  },
  {
    "word": "contemporary",
    "phonetic": "[kənˈtempərəri]",
    "meaning": "当代的"
  },
  {
    "word": "contend",
    "phonetic": "[kənˈtend]",
    "meaning": "主张"
  },
  {
    "word": "content",
    "phonetic": "[ˈkɒntent]",
    "meaning": "内容"
  },
  {
    "word": "contest",
    "phonetic": "[ˈkɒntest]",
    "meaning": "竞赛"
  },
  {
    "word": "context",
    "phonetic": "[ˈkɒntekst]",
    "meaning": "上下文"
  },
  {
    "word": "continent",
    "phonetic": "[ˈkɒntɪnənt]",
    "meaning": "大陆"
  },
  {
    "word": "continual",
    "phonetic": "[kənˈtɪnjuəl]",
    "meaning": "不断的"
  },
  {
    "word": "continue",
    "phonetic": "[kənˈtɪnjuː]",
    "meaning": "继续"
  },
  {
    "word": "continuous",
    "phonetic": "[kənˈtɪnjuəs]",
    "meaning": "连续的"
  },
  {
    "word": "contract",
    "phonetic": "[ˈkɒntrækt]",
    "meaning": "合同"
  },
  {
    "word": "consciousness",
    "phonetic": "[ˈkɒnʃəsnəs]",
    "meaning": "意识"
  },
  {
    "word": "conspicuous",
    "phonetic": "[kənˈspɪkjuəs]",
    "meaning": "明显的"
  },
  {
    "word": "contempt",
    "phonetic": "[kənˈtempt]",
    "meaning": "轻视"
  },
  {
    "word": "continually",
    "phonetic": "[kənˈtɪnjuəli]",
    "meaning": "不断地"
  },
  {
    "word": "contradict",
    "phonetic": "[ˌkɒntrəˈdɪkt]",
    "meaning": "反驳"
  },
  {
    "word": "contradiction",
    "phonetic": "[ˌkɒntrəˈdɪkʃn]",
    "meaning": "矛盾"
  },
  {
    "word": "contrary",
    "phonetic": "[ˈkɒntrəri]",
    "meaning": "相反的"
  },
  {
    "word": "contrast",
    "phonetic": "[ˈkɒntrɑːst]",
    "meaning": "对比"
  },
  {
    "word": "contribute",
    "phonetic": "[kənˈtrɪbjuːt]",
    "meaning": "贡献"
  },
  {
    "word": "contribution",
    "phonetic": "[ˌkɒntrɪˈbjuːʃn]",
    "meaning": "贡献"
  },
  {
    "word": "controversial",
    "phonetic": "[ˌkɒntrəˈvɜːʃl]",
    "meaning": "有争议的"
  },
  {
    "word": "controversy",
    "phonetic": "[ˈkɒntrəvɜːsi]",
    "meaning": "争议"
  },
  {
    "word": "convenience",
    "phonetic": "[kənˈviːniəns]",
    "meaning": "方便"
  },
  {
    "word": "convenient",
    "phonetic": "[kənˈviːniənt]",
    "meaning": "方便的"
  },
  {
    "word": "convention",
    "phonetic": "[kənˈvenʃn]",
    "meaning": "会议"
  },
  {
    "word": "conventional",
    "phonetic": "[kənˈvenʃənl]",
    "meaning": "传统的"
  },
  {
    "word": "conversation",
    "phonetic": "[ˌkɒnvəˈseɪʃn]",
    "meaning": "对话"
  },
  {
    "word": "convert",
    "phonetic": "[kənˈvɜːt]",
    "meaning": "转换"
  },
  {
    "word": "conversion",
    "phonetic": "[kənˈvɜːʃn]",
    "meaning": "转换"
  },
  {
    "word": "convince",
    "phonetic": "[kənˈvɪns]",
    "meaning": "说服"
  },
  {
    "word": "conviction",
    "phonetic": "[kənˈvɪkʃn]",
    "meaning": "信念"
  },
  {
    "word": "cook",
    "phonetic": "[kʊk]",
    "meaning": "烹饪"
  },
  {
    "word": "cool",
    "phonetic": "[kuːl]",
    "meaning": "凉爽的"
  },
  {
    "word": "cooperate",
    "phonetic": "[kəʊˈɒpəreɪt]",
    "meaning": "合作"
  },
  {
    "word": "cooperation",
    "phonetic": "[kəʊˌɒpəˈreɪʃn]",
    "meaning": "合作"
  },
  {
    "word": "coordinate",
    "phonetic": "[kəʊˈɔːdɪneɪt]",
    "meaning": "协调"
  },
  {
    "word": "cop",
    "phonetic": "[kɒp]",
    "meaning": "警察"
  },
  {
    "word": "cope",
    "phonetic": "[kəʊp]",
    "meaning": "应对"
  },
  {
    "word": "copper",
    "phonetic": "[ˈkɒpə(r)]",
    "meaning": "铜"
  },
  {
    "word": "copy",
    "phonetic": "[ˈkɒpi]",
    "meaning": "复制"
  },
  {
    "word": "copyright",
    "phonetic": "[ˈkɒpiraɪt]",
    "meaning": "版权"
  },
  {
    "word": "core",
    "phonetic": "[kɔː(r)]",
    "meaning": "核心"
  },
  {
    "word": "corn",
    "phonetic": "[kɔːn]",
    "meaning": "玉米"
  },
  {
    "word": "corner",
    "phonetic": "[ˈkɔːnə(r)]",
    "meaning": "角落"
  },
  {
    "word": "corporation",
    "phonetic": "[ˌkɔːpəˈreɪʃn]",
    "meaning": "公司"
  },
  {
    "word": "correct",
    "phonetic": "[kəˈrekt]",
    "meaning": "正确的"
  },
  {
    "word": "correction",
    "phonetic": "[kəˈrekʃn]",
    "meaning": "修正"
  },
  {
    "word": "correspond",
    "phonetic": "[ˌkɒrəˈspɒnd]",
    "meaning": "通信"
  },
  {
    "word": "correspondence",
    "phonetic": "[ˌkɒrəˈspɒndəns]",
    "meaning": "通信"
  },
  {
    "word": "correspondent",
    "phonetic": "[ˌkɒrəˈspɒndənt]",
    "meaning": "记者"
  },
  {
    "word": "corresponding",
    "phonetic": "[ˌkɒrəˈspɒndɪŋ]",
    "meaning": "相应的"
  },
  {
    "word": "corridor",
    "phonetic": "[ˈkɒrɪdɔː(r)]",
    "meaning": "走廊"
  },
  {
    "word": "cost",
    "phonetic": "[kɒst]",
    "meaning": "成本"
  },
  {
    "word": "costly",
    "phonetic": "[ˈkɒstli]",
    "meaning": "昂贵的"
  },
  {
    "word": "cottage",
    "phonetic": "[ˈkɒtɪdʒ]",
    "meaning": "小屋"
  },
  {
    "word": "cotton",
    "phonetic": "[ˈkɒtn]",
    "meaning": "棉花"
  },
  {
    "word": "cough",
    "phonetic": "[kɒf]",
    "meaning": "咳嗽"
  },
  {
    "word": "could",
    "phonetic": "[kʊd]",
    "meaning": "能够"
  },
  {
    "word": "count",
    "phonetic": "[kaʊnt]",
    "meaning": "计数"
  },
  {
    "word": "counter",
    "phonetic": "[ˈkaʊntə(r)]",
    "meaning": "柜台"
  },
  {
    "word": "country",
    "phonetic": "[ˈkʌntri]",
    "meaning": "国家"
  },
  {
    "word": "countryside",
    "phonetic": "[ˈkʌntrisaɪd]",
    "meaning": "乡村"
  },
  {
    "word": "county",
    "phonetic": "[ˈkaʊnti]",
    "meaning": "县"
  },
  {
    "word": "couple",
    "phonetic": "[ˈkʌpl]",
    "meaning": "夫妻"
  },
  {
    "word": "courage",
    "phonetic": "[ˈkʌrɪdʒ]",
    "meaning": "勇气"
  },
  {
    "word": "course",
    "phonetic": "[kɔːs]",
    "meaning": "课程"
  },
  {
    "word": "court",
    "phonetic": "[kɔːt]",
    "meaning": "法院"
  },
  {
    "word": "cousin",
    "phonetic": "[ˈkʌzn]",
    "meaning": "堂兄弟"
  },
  {
    "word": "cover",
    "phonetic": "[ˈkʌvə(r)]",
    "meaning": "覆盖"
  },
  {
    "word": "cow",
    "phonetic": "[kaʊ]",
    "meaning": "奶牛"
  },
  {
    "word": "coward",
    "phonetic": "[ˈkaʊəd]",
    "meaning": "胆小鬼"
  },
  {
    "word": "crack",
    "phonetic": "[kræk]",
    "meaning": "裂缝"
  },
  {
    "word": "craft",
    "phonetic": "[krɑːft]",
    "meaning": "工艺"
  },
  {
    "word": "crash",
    "phonetic": "[kræʃ]",
    "meaning": "碰撞"
  },
  {
    "word": "crawl",
    "phonetic": "[krɔːl]",
    "meaning": "爬行"
  },
  {
    "word": "crazy",
    "phonetic": "[ˈkreɪzi]",
    "meaning": "疯狂的"
  },
  {
    "word": "cream",
    "phonetic": "[kriːm]",
    "meaning": "奶油"
  },
  {
    "word": "create",
    "phonetic": "[kriˈeɪt]",
    "meaning": "创造"
  },
  {
    "word": "creation",
    "phonetic": "[kriˈeɪʃn]",
    "meaning": "创造"
  },
  {
    "word": "creative",
    "phonetic": "[kriˈeɪtɪv]",
    "meaning": "创造性的"
  },
  {
    "word": "creature",
    "phonetic": "[ˈkriːtʃə(r)]",
    "meaning": "生物"
  },
  {
    "word": "credit",
    "phonetic": "[ˈkredɪt]",
    "meaning": "信用"
  },
  {
    "word": "creep",
    "phonetic": "[kriːp]",
    "meaning": "爬行"
  },
  {
    "word": "crew",
    "phonetic": "[kruː]",
    "meaning": "船员"
  },
  {
    "word": "crime",
    "phonetic": "[kraɪm]",
    "meaning": "犯罪"
  },
  {
    "word": "criminal",
    "phonetic": "[ˈkrɪmɪnl]",
    "meaning": "罪犯"
  },
  {
    "word": "crisis",
    "phonetic": "[ˈkraɪsɪs]",
    "meaning": "危机"
  },
  {
    "word": "critic",
    "phonetic": "[ˈkrɪtɪk]",
    "meaning": "评论家"
  },
  {
    "word": "critical",
    "phonetic": "[ˈkrɪtɪkl]",
    "meaning": "批评的"
  },
  {
    "word": "criticism",
    "phonetic": "[ˈkrɪtɪsɪzəm]",
    "meaning": "批评"
  },
  {
    "word": "criticize",
    "phonetic": "[ˈkrɪtɪsaɪz]",
    "meaning": "批评"
  },
  {
    "word": "crop",
    "phonetic": "[krɒp]",
    "meaning": "庄稼"
  },
  {
    "word": "cross",
    "phonetic": "[krɒs]",
    "meaning": "交叉"
  },
  {
    "word": "crossing",
    "phonetic": "[ˈkrɒsɪŋ]",
    "meaning": "十字路口"
  },
  {
    "word": "crowd",
    "phonetic": "[kraʊd]",
    "meaning": "人群"
  },
  {
    "word": "crown",
    "phonetic": "[kraʊn]",
    "meaning": "王冠"
  },
  {
    "word": "crude",
    "phonetic": "[kruːd]",
    "meaning": "粗糙的"
  },
  {
    "word": "cruel",
    "phonetic": "[kruːəl]",
    "meaning": "残忍的"
  },
  {
    "word": "cruelty",
    "phonetic": "[ˈkruːəlti]",
    "meaning": "残忍"
  },
  {
    "word": "cruise",
    "phonetic": "[kruːz]",
    "meaning": "巡航"
  },
  {
    "word": "crumble",
    "phonetic": "[ˈkrʌmbl]",
    "meaning": "崩溃"
  },
  {
    "word": "crush",
    "phonetic": "[krʌʃ]",
    "meaning": "压碎"
  },
  {
    "word": "crust",
    "phonetic": "[krʌst]",
    "meaning": "地壳"
  },
  {
    "word": "cry",
    "phonetic": "[kraɪ]",
    "meaning": "哭泣"
  },
  {
    "word": "crystal",
    "phonetic": "[ˈkrɪstl]",
    "meaning": "水晶"
  },
  {
    "word": "cube",
    "phonetic": "[kjuːb]",
    "meaning": "立方体"
  },
  {
    "word": "cubic",
    "phonetic": "[ˈkjuːbɪk]",
    "meaning": "立方的"
  },
  {
    "word": "cucumber",
    "phonetic": "[ˈkjuːkʌmbə(r)]",
    "meaning": "黄瓜"
  },
  {
    "word": "cultivate",
    "phonetic": "[ˈkʌltɪveɪt]",
    "meaning": "培养"
  },
  {
    "word": "culture",
    "phonetic": "[ˈkʌltʃə(r)]",
    "meaning": "文化"
  },
  {
    "word": "cunning",
    "phonetic": "[ˈkʌnɪŋ]",
    "meaning": "狡猾的"
  },
  {
    "word": "cup",
    "phonetic": "[kʌp]",
    "meaning": "杯子"
  },
  {
    "word": "cupboard",
    "phonetic": "[ˈkʌbəd]",
    "meaning": "碗柜"
  },
  {
    "word": "cure",
    "phonetic": "[kjʊə(r)]",
    "meaning": "治愈"
  },
  {
    "word": "curiosity",
    "phonetic": "[ˌkjʊəriˈɒsəti]",
    "meaning": "好奇心"
  },
  {
    "word": "curious",
    "phonetic": "[ˈkjʊəriəs]",
    "meaning": "好奇的"
  },
  {
    "word": "curl",
    "phonetic": "[kɜːl]",
    "meaning": "卷曲"
  },
  {
    "word": "current",
    "phonetic": "[ˈkʌrənt]",
    "meaning": "当前的"
  },
  {
    "word": "curriculum",
    "phonetic": "[kəˈrɪkjələm]",
    "meaning": "课程"
  },
  {
    "word": "curse",
    "phonetic": "[kɜːs]",
    "meaning": "诅咒"
  },
  {
    "word": "curtain",
    "phonetic": "[ˈkɜːtn]",
    "meaning": "窗帘"
  },
  {
    "word": "curve",
    "phonetic": "[kɜːv]",
    "meaning": "曲线"
  },
  {
    "word": "cushion",
    "phonetic": "[ˈkʊʃn]",
    "meaning": "垫子"
  },
  {
    "word": "custom",
    "phonetic": "[ˈkʌstəm]",
    "meaning": "习惯"
  },
  {
    "word": "customer",
    "phonetic": "[ˈkʌstəmə(r)]",
    "meaning": "顾客"
  },
  {
    "word": "customs",
    "phonetic": "[ˈkʌstəmz]",
    "meaning": "海关"
  },
  {
    "word": "cut",
    "phonetic": "[kʌt]",
    "meaning": "切"
  },
  {
    "word": "cutting",
    "phonetic": "[ˈkʌtɪŋ]",
    "meaning": "切割"
  },
  {
    "word": "cycle",
    "phonetic": "[ˈsaɪkl]",
    "meaning": "循环"
  },
  {
    "word": "cyclist",
    "phonetic": "[ˈsaɪklɪst]",
    "meaning": "骑自行车的人"
  },
  {
    "word": "dad",
    "phonetic": "[dæd]",
    "meaning": "爸爸"
  },
  {
    "word": "daily",
    "phonetic": "[ˈdeɪli]",
    "meaning": "日常的"
  },
  {
    "word": "damage",
    "phonetic": "[ˈdæmɪdʒ]",
    "meaning": "损害"
  },
  {
    "word": "damn",
    "phonetic": "[dæm]",
    "meaning": "该死的"
  },
  {
    "word": "damp",
    "phonetic": "[dæmp]",
    "meaning": "潮湿的"
  },
  {
    "word": "dance",
    "phonetic": "[dɑːns]",
    "meaning": "跳舞"
  },
  {
    "word": "danger",
    "phonetic": "[ˈdeɪndʒə(r)]",
    "meaning": "危险"
  },
  {
    "word": "dangerous",
    "phonetic": "[ˈdeɪndʒərəs]",
    "meaning": "危险的"
  },
  {
    "word": "dare",
    "phonetic": "[deə(r)]",
    "meaning": "敢"
  },
  {
    "word": "dark",
    "phonetic": "[dɑːk]",
    "meaning": "黑暗的"
  },
  {
    "word": "darkness",
    "phonetic": "[ˈdɑːknəs]",
    "meaning": "黑暗"
  },
  {
    "word": "darling",
    "phonetic": "[ˈdɑːlɪŋ]",
    "meaning": "亲爱的"
  },
  {
    "word": "dash",
    "phonetic": "[dæʃ]",
    "meaning": "冲刺"
  },
  {
    "word": "data",
    "phonetic": "[ˈdeɪtə]",
    "meaning": "数据"
  },
  {
    "word": "database",
    "phonetic": "[ˈdeɪtəbeɪs]",
    "meaning": "数据库"
  },
  {
    "word": "date",
    "phonetic": "[deɪt]",
    "meaning": "日期"
  },
  {
    "word": "daughter",
    "phonetic": "[ˈdɔːtə(r)]",
    "meaning": "女儿"
  },
  {
    "word": "dawn",
    "phonetic": "[dɔːn]",
    "meaning": "黎明"
  },
  {
    "word": "day",
    "phonetic": "[deɪ]",
    "meaning": "天"
  },
  {
    "word": "daytime",
    "phonetic": "[ˈdeɪtaɪm]",
    "meaning": "白天"
  },
  {
    "word": "dead",
    "phonetic": "[ded]",
    "meaning": "死的"
  },
  {
    "word": "deadline",
    "phonetic": "[ˈdedlaɪn]",
    "meaning": "截止日期"
  },
  {
    "word": "deaf",
    "phonetic": "[def]",
    "meaning": "聋的"
  },
  {
    "word": "deal",
    "phonetic": "[diːl]",
    "meaning": "处理"
  },
  {
    "word": "dealer",
    "phonetic": "[ˈdiːlə(r)]",
    "meaning": "经销商"
  },
  {
    "word": "dear",
    "phonetic": "[dɪə(r)]",
    "meaning": "亲爱的"
  },
  {
    "word": "death",
    "phonetic": "[deθ]",
    "meaning": "死亡"
  },
  {
    "word": "debate",
    "phonetic": "[dɪˈbeɪt]",
    "meaning": "辩论"
  },
  {
    "word": "debt",
    "phonetic": "[det]",
    "meaning": "债务"
  },
  {
    "word": "december",
    "phonetic": "[dɪˈsembə(r)]",
    "meaning": "十二月"
  },
  {
    "word": "decent",
    "phonetic": "[ˈdiːsnt]",
    "meaning": "体面的"
  },
  {
    "word": "decide",
    "phonetic": "[dɪˈsaɪd]",
    "meaning": "决定"
  },
  {
    "word": "decision",
    "phonetic": "[dɪˈsɪʒn]",
    "meaning": "决定"
  },
  {
    "word": "declare",
    "phonetic": "[dɪˈkleə(r)]",
    "meaning": "宣布"
  },
  {
    "word": "declaration",
    "phonetic": "[ˌdekləˈreɪʃn]",
    "meaning": "宣布"
  },
  {
    "word": "decline",
    "phonetic": "[dɪˈklaɪn]",
    "meaning": "下降"
  },
  {
    "word": "decorate",
    "phonetic": "[ˈdekəreɪt]",
    "meaning": "装饰"
  },
  {
    "word": "decoration",
    "phonetic": "[ˌdekəˈreɪʃn]",
    "meaning": "装饰"
  },
  {
    "word": "decrease",
    "phonetic": "[dɪˈkriːs]",
    "meaning": "减少"
  },
  {
    "word": "deed",
    "phonetic": "[diːd]",
    "meaning": "行为"
  },
  {
    "word": "deep",
    "phonetic": "[diːp]",
    "meaning": "深的"
  },
  {
    "word": "deer",
    "phonetic": "[dɪə(r)]",
    "meaning": "鹿"
  },
  {
    "word": "defeat",
    "phonetic": "[dɪˈfiːt]",
    "meaning": "击败"
  },
  {
    "word": "defence",
    "phonetic": "[dɪˈfens]",
    "meaning": "防御"
  },
  {
    "word": "defend",
    "phonetic": "[dɪˈfend]",
    "meaning": "防御"
  },
  {
    "word": "defense",
    "phonetic": "[dɪˈfens]",
    "meaning": "防御"
  },
  {
    "word": "defensive",
    "phonetic": "[dɪˈfensɪv]",
    "meaning": "防御的"
  },
  {
    "word": "deficit",
    "phonetic": "[ˈdefɪsɪt]",
    "meaning": "赤字"
  },
  {
    "word": "define",
    "phonetic": "[dɪˈfaɪn]",
    "meaning": "定义"
  },
  {
    "word": "definite",
    "phonetic": "[ˈdefɪnət]",
    "meaning": "明确的"
  },
  {
    "word": "definitely",
    "phonetic": "[ˈdefɪnətli]",
    "meaning": "肯定地"
  },
  {
    "word": "definition",
    "phonetic": "[ˌdefɪˈnɪʃn]",
    "meaning": "定义"
  },
  {
    "word": "degree",
    "phonetic": "[dɪˈɡriː]",
    "meaning": "度"
  },
  {
    "word": "delay",
    "phonetic": "[dɪˈleɪ]",
    "meaning": "延迟"
  },
  {
    "word": "delete",
    "phonetic": "[dɪˈliːt]",
    "meaning": "删除"
  },
  {
    "word": "deliberate",
    "phonetic": "[dɪˈlɪbərət]",
    "meaning": "故意的"
  },
  {
    "word": "delicate",
    "phonetic": "[ˈdelɪkət]",
    "meaning": "精致的"
  },
  {
    "word": "delicious",
    "phonetic": "[dɪˈlɪʃəs]",
    "meaning": "美味的"
  },
  {
    "word": "delight",
    "phonetic": "[dɪˈlaɪt]",
    "meaning": "高兴"
  },
  {
    "word": "deliver",
    "phonetic": "[dɪˈlɪvə(r)]",
    "meaning": "递送"
  },
  {
    "word": "delivery",
    "phonetic": "[dɪˈlɪvəri]",
    "meaning": "递送"
  },
  {
    "word": "demand",
    "phonetic": "[dɪˈmɑːnd]",
    "meaning": "要求"
  },
  {
    "word": "democracy",
    "phonetic": "[dɪˈmɒkrəsi]",
    "meaning": "民主"
  },
  {
    "word": "democratic",
    "phonetic": "[ˌdeməˈkrætɪk]",
    "meaning": "民主的"
  },
  {
    "word": "demonstrate",
    "phonetic": "[ˈdemənstreɪt]",
    "meaning": "展示"
  },
  {
    "word": "demonstration",
    "phonetic": "[ˌdemənˈstreɪʃn]",
    "meaning": "展示"
  },
  {
    "word": "deny",
    "phonetic": "[dɪˈnaɪ]",
    "meaning": "否认"
  },
  {
    "word": "depart",
    "phonetic": "[dɪˈpɑːt]",
    "meaning": "离开"
  },
  {
    "word": "department",
    "phonetic": "[dɪˈpɑːtmənt]",
    "meaning": "部门"
  },
  {
    "word": "departure",
    "phonetic": "[dɪˈpɑːtʃə(r)]",
    "meaning": "离开"
  },
  {
    "word": "depend",
    "phonetic": "[dɪˈpend]",
    "meaning": "依赖"
  },
  {
    "word": "dependent",
    "phonetic": "[dɪˈpendənt]",
    "meaning": "依赖的"
  },
  {
    "word": "deposit",
    "phonetic": "[dɪˈpɒzɪt]",
    "meaning": "存款"
  },
  {
    "word": "depress",
    "phonetic": "[dɪˈpres]",
    "meaning": "使沮丧"
  },
  {
    "word": "depression",
    "phonetic": "[dɪˈpreʃn]",
    "meaning": "抑郁"
  },
  {
    "word": "depth",
    "phonetic": "[deptθ]",
    "meaning": "深度"
  },
  {
    "word": "derive",
    "phonetic": "[dɪˈraɪv]",
    "meaning": "衍生"
  },
  {
    "word": "describe",
    "phonetic": "[dɪˈskraɪb]",
    "meaning": "描述"
  },
  {
    "word": "description",
    "phonetic": "[dɪˈskrɪpʃn]",
    "meaning": "描述"
  },
  {
    "word": "desert",
    "phonetic": "[ˈdezət]",
    "meaning": "沙漠"
  },
  {
    "word": "deserve",
    "phonetic": "[dɪˈzɜːv]",
    "meaning": "应得"
  },
  {
    "word": "design",
    "phonetic": "[dɪˈzaɪn]",
    "meaning": "设计"
  },
  {
    "word": "designer",
    "phonetic": "[dɪˈzaɪnə(r)]",
    "meaning": "设计师"
  },
  {
    "word": "desire",
    "phonetic": "[dɪˈzaɪə(r)]",
    "meaning": "欲望"
  },
  {
    "word": "desk",
    "phonetic": "[desk]",
    "meaning": "书桌"
  },
  {
    "word": "desperate",
    "phonetic": "[ˈdespərət]",
    "meaning": "绝望的"
  },
  {
    "word": "despite",
    "phonetic": "[dɪˈspaɪt]",
    "meaning": "尽管"
  },
  {
    "word": "dessert",
    "phonetic": "[dɪˈzɜːt]",
    "meaning": "甜点"
  },
  {
    "word": "destination",
    "phonetic": "[ˌdestɪˈneɪʃn]",
    "meaning": "目的地"
  },
  {
    "word": "destroy",
    "phonetic": "[dɪˈstrɔɪ]",
    "meaning": "摧毁"
  },
  {
    "word": "destruction",
    "phonetic": "[dɪˈstrʌkʃn]",
    "meaning": "摧毁"
  },
  {
    "word": "detail",
    "phonetic": "[ˈdiːteɪl]",
    "meaning": "细节"
  },
  {
    "word": "detailed",
    "phonetic": "[ˈdiːteɪld]",
    "meaning": "详细的"
  },
  {
    "word": "detect",
    "phonetic": "[dɪˈtekt]",
    "meaning": "检测"
  },
  {
    "word": "detection",
    "phonetic": "[dɪˈtekʃn]",
    "meaning": "检测"
  },
  {
    "word": "determine",
    "phonetic": "[dɪˈtɜːmɪn]",
    "meaning": "确定"
  },
  {
    "word": "determination",
    "phonetic": "[dɪˌtɜːmɪˈneɪʃn]",
    "meaning": "决心"
  },
  {
    "word": "develop",
    "phonetic": "[dɪˈveləp]",
    "meaning": "发展"
  },
  {
    "word": "development",
    "phonetic": "[dɪˈveləpmənt]",
    "meaning": "发展"
  },
  {
    "word": "device",
    "phonetic": "[dɪˈvaɪs]",
    "meaning": "设备"
  },
  {
    "word": "devil",
    "phonetic": "[ˈdevl]",
    "meaning": "魔鬼"
  },
  {
    "word": "devote",
    "phonetic": "[dɪˈvəʊt]",
    "meaning": "致力于"
  },
  {
    "word": "devotion",
    "phonetic": "[dɪˈvəʊʃn]",
    "meaning": "奉献"
  },
  {
    "word": "diagram",
    "phonetic": "[ˈdaɪəɡræm]",
    "meaning": "图表"
  },
  {
    "word": "dial",
    "phonetic": "[ˈdaɪəl]",
    "meaning": "拨号"
  },
  {
    "word": "dialogue",
    "phonetic": "[ˈdaɪəlɒɡ]",
    "meaning": "对话"
  },
  {
    "word": "diamond",
    "phonetic": "[ˈdaɪəmənd]",
    "meaning": "钻石"
  },
  {
    "word": "diary",
    "phonetic": "[ˈdaɪəri]",
    "meaning": "日记"
  },
  {
    "word": "dictate",
    "phonetic": "[dɪkˈteɪt]",
    "meaning": "听写"
  },
  {
    "word": "dictation",
    "phonetic": "[dɪkˈteɪʃn]",
    "meaning": "听写"
  },
  {
    "word": "dictionary",
    "phonetic": "[ˈdɪkʃənri]",
    "meaning": "字典"
  },
  {
    "word": "die",
    "phonetic": "[daɪ]",
    "meaning": "死"
  },
  {
    "word": "diet",
    "phonetic": "[ˈdaɪət]",
    "meaning": "饮食"
  },
  {
    "word": "differ",
    "phonetic": "[ˈdɪfə(r)]",
    "meaning": "不同"
  },
  {
    "word": "difference",
    "phonetic": "[ˈdɪfrəns]",
    "meaning": "差异"
  },
  {
    "word": "different",
    "phonetic": "[ˈdɪfrənt]",
    "meaning": "不同的"
  },
  {
    "word": "difficult",
    "phonetic": "[ˈdɪfɪkəlt]",
    "meaning": "困难的"
  },
  {
    "word": "difficulty",
    "phonetic": "[ˈdɪfɪkəlti]",
    "meaning": "困难"
  },
  {
    "word": "dig",
    "phonetic": "[dɪɡ]",
    "meaning": "挖"
  },
  {
    "word": "digest",
    "phonetic": "[daɪˈdʒest]",
    "meaning": "消化"
  },
  {
    "word": "digital",
    "phonetic": "[ˈdɪdʒɪtl]",
    "meaning": "数字的"
  },
  {
    "word": "dim",
    "phonetic": "[dɪm]",
    "meaning": "昏暗的"
  },
  {
    "word": "dimension",
    "phonetic": "[daɪˈmenʃn]",
    "meaning": "维度"
  },
  {
    "word": "dinner",
    "phonetic": "[ˈdɪnə(r)]",
    "meaning": "晚餐"
  },
  {
    "word": "dinosaur",
    "phonetic": "[ˈdaɪnəsɔː(r)]",
    "meaning": "恐龙"
  },
  {
    "word": "direct",
    "phonetic": "[dəˈrekt]",
    "meaning": "直接的"
  },
  {
    "word": "direction",
    "phonetic": "[dəˈrekʃn]",
    "meaning": "方向"
  },
  {
    "word": "directly",
    "phonetic": "[dəˈrektli]",
    "meaning": "直接地"
  },
  {
    "word": "director",
    "phonetic": "[dəˈrektə(r)]",
    "meaning": "导演"
  },
  {
    "word": "directory",
    "phonetic": "[dəˈrektəri]",
    "meaning": "目录"
  },
  {
    "word": "dirt",
    "phonetic": "[dɜːt]",
    "meaning": "泥土"
  },
  {
    "word": "dirty",
    "phonetic": "[ˈdɜːti]",
    "meaning": "脏的"
  },
  {
    "word": "disable",
    "phonetic": "[dɪsˈeɪbl]",
    "meaning": "使残废"
  },
  {
    "word": "disadvantage",
    "phonetic": "[ˌdɪsədˈvɑːntɪdʒ]",
    "meaning": "不利"
  },
  {
    "word": "disagree",
    "phonetic": "[ˌdɪsəˈɡriː]",
    "meaning": "不同意"
  },
  {
    "word": "disagreement",
    "phonetic": "[ˌdɪsəˈɡriːmənt]",
    "meaning": "分歧"
  },
  {
    "word": "disappear",
    "phonetic": "[ˌdɪsəˈpɪə(r)]",
    "meaning": "消失"
  },
  {
    "word": "disappoint",
    "phonetic": "[ˌdɪsəˈpɔɪnt]",
    "meaning": "使失望"
  },
  {
    "word": "disappointment",
    "phonetic": "[ˌdɪsəˈpɔɪntmənt]",
    "meaning": "失望"
  },
  {
    "word": "disaster",
    "phonetic": "[dɪˈzɑːstə(r)]",
    "meaning": "灾难"
  },
  {
    "word": "disastrous",
    "phonetic": "[dɪˈzɑːstrəs]",
    "meaning": "灾难性的"
  },
  {
    "word": "disc",
    "phonetic": "[dɪsk]",
    "meaning": "圆盘"
  },
  {
    "word": "discard",
    "phonetic": "[dɪsˈkɑːd]",
    "meaning": "丢弃"
  },
  {
    "word": "discharge",
    "phonetic": "[dɪsˈtʃɑːdʒ]",
    "meaning": "释放"
  },
  {
    "word": "discipline",
    "phonetic": "[ˈdɪsəplɪn]",
    "meaning": "纪律"
  },
  {
    "word": "discover",
    "phonetic": "[dɪsˈkʌvə(r)]",
    "meaning": "发现"
  },
  {
    "word": "discovery",
    "phonetic": "[dɪsˈkʌvəri]",
    "meaning": "发现"
  },
  {
    "word": "discuss",
    "phonetic": "[dɪˈskʌs]",
    "meaning": "讨论"
  },
  {
    "word": "discussion",
    "phonetic": "[dɪˈskʌʃn]",
    "meaning": "讨论"
  },
  {
    "word": "disease",
    "phonetic": "[dɪˈziːz]",
    "meaning": "疾病"
  },
  {
    "word": "disguise",
    "phonetic": "[dɪsˈɡaɪz]",
    "meaning": "伪装"
  },
  {
    "word": "disgust",
    "phonetic": "[dɪsˈɡʌst]",
    "meaning": "厌恶"
  },
  {
    "word": "dish",
    "phonetic": "[dɪʃ]",
    "meaning": "盘子"
  },
  {
    "word": "dislike",
    "phonetic": "[dɪsˈlaɪk]",
    "meaning": "不喜欢"
  },
  {
    "word": "dismiss",
    "phonetic": "[dɪsˈmɪs]",
    "meaning": "解雇"
  },
  {
    "word": "disorder",
    "phonetic": "[dɪsˈɔːdə(r)]",
    "meaning": "混乱"
  },
  {
    "word": "display",
    "phonetic": "[dɪˈspleɪ]",
    "meaning": "展示"
  },
  {
    "word": "displease",
    "phonetic": "[dɪsˈpliːz]",
    "meaning": "使不满"
  },
  {
    "word": "disposal",
    "phonetic": "[dɪˈspəʊzl]",
    "meaning": "处理"
  },
  {
    "word": "dispose",
    "phonetic": "[dɪˈspəʊz]",
    "meaning": "处理"
  },
  {
    "word": "dispute",
    "phonetic": "[dɪˈspjuːt]",
    "meaning": "争论"
  },
  {
    "word": "dissatisfy",
    "phonetic": "[dɪsˈsætɪsfaɪ]",
    "meaning": "使不满意"
  },
  {
    "word": "distance",
    "phonetic": "[ˈdɪstəns]",
    "meaning": "距离"
  },
  {
    "word": "distant",
    "phonetic": "[ˈdɪstənt]",
    "meaning": "遥远的"
  },
  {
    "word": "distinguish",
    "phonetic": "[dɪˈstɪŋɡwɪʃ]",
    "meaning": "区分"
  },
  {
    "word": "distribute",
    "phonetic": "[dɪˈstrɪbjuːt]",
    "meaning": "分发"
  },
  {
    "word": "distribution",
    "phonetic": "[ˌdɪstrɪˈbjuːʃn]",
    "meaning": "分发"
  },
  {
    "word": "district",
    "phonetic": "[ˈdɪstrɪkt]",
    "meaning": "区域"
  },
  {
    "word": "disturb",
    "phonetic": "[dɪˈstɜːb]",
    "meaning": "打扰"
  },
  {
    "word": "disturbance",
    "phonetic": "[dɪˈstɜːbəns]",
    "meaning": "打扰"
  },
  {
    "word": "ditch",
    "phonetic": "[dɪtʃ]",
    "meaning": "沟渠"
  },
  {
    "word": "dive",
    "phonetic": "[daɪv]",
    "meaning": "潜水"
  },
  {
    "word": "diverse",
    "phonetic": "[daɪˈvɜːs]",
    "meaning": "多样的"
  },
  {
    "word": "diversity",
    "phonetic": "[daɪˈvɜːsəti]",
    "meaning": "多样性"
  },
  {
    "word": "divide",
    "phonetic": "[dɪˈvaɪd]",
    "meaning": "划分"
  },
  {
    "word": "division",
    "phonetic": "[dɪˈvɪʒn]",
    "meaning": "划分"
  },
  {
    "word": "divorce",
    "phonetic": "[dɪˈvɔːs]",
    "meaning": "离婚"
  },
  {
    "word": "dizzy",
    "phonetic": "[ˈdɪzi]",
    "meaning": "头晕的"
  },
  {
    "word": "do",
    "phonetic": "[duː]",
    "meaning": "做"
  },
  {
    "word": "doctor",
    "phonetic": "[ˈdɒktə(r)]",
    "meaning": "医生"
  },
  {
    "word": "document",
    "phonetic": "[ˈdɒkjumənt]",
    "meaning": "文件"
  },
  {
    "word": "documentation",
    "phonetic": "[ˌdɒkjumenˈteɪʃn]",
    "meaning": "文档"
  },
  {
    "word": "dog",
    "phonetic": "[dɒɡ]",
    "meaning": "狗"
  },
  {
    "word": "doll",
    "phonetic": "[dɒl]",
    "meaning": "玩偶"
  },
  {
    "word": "dollar",
    "phonetic": "[ˈdɒlə(r)]",
    "meaning": "美元"
  },
  {
    "word": "domestic",
    "phonetic": "[dəˈmestɪk]",
    "meaning": "国内的"
  },
  {
    "word": "dominate",
    "phonetic": "[ˈdɒmɪneɪt]",
    "meaning": "支配"
  },
  {
    "word": "dominant",
    "phonetic": "[ˈdɒmɪnənt]",
    "meaning": "占主导地位的"
  },
  {
    "word": "dominion",
    "phonetic": "[dəˈmɪniən]",
    "meaning": "统治"
  },
  {
    "word": "donate",
    "phonetic": "[dəʊˈneɪt]",
    "meaning": "捐赠"
  },
  {
    "word": "donation",
    "phonetic": "[dəʊˈneɪʃn]",
    "meaning": "捐赠"
  },
  {
    "word": "donkey",
    "phonetic": "[ˈdɒŋki]",
    "meaning": "驴"
  },
  {
    "word": "doom",
    "phonetic": "[duːm]",
    "meaning": "厄运"
  },
  {
    "word": "door",
    "phonetic": "[dɔː(r)]",
    "meaning": "门"
  },
  {
    "word": "dormitory",
    "phonetic": "[ˈdɔːmɪtri]",
    "meaning": "宿舍"
  },
  {
    "word": "dose",
    "phonetic": "[dəʊs]",
    "meaning": "剂量"
  },
  {
    "word": "dot",
    "phonetic": "[dɒt]",
    "meaning": "点"
  },
  {
    "word": "double",
    "phonetic": "[ˈdʌbl]",
    "meaning": "双重的"
  },
  {
    "word": "doubt",
    "phonetic": "[daʊt]",
    "meaning": "怀疑"
  },
  {
    "word": "doubtful",
    "phonetic": "[ˈdaʊtfl]",
    "meaning": "可疑的"
  },
  {
    "word": "dove",
    "phonetic": "[dʌv]",
    "meaning": "鸽子"
  },
  {
    "word": "down",
    "phonetic": "[daʊn]",
    "meaning": "向下"
  },
  {
    "word": "downstairs",
    "phonetic": "[ˌdaʊnˈsteəz]",
    "meaning": "楼下"
  },
  {
    "word": "downtown",
    "phonetic": "[ˌdaʊnˈtaʊn]",
    "meaning": "市中心"
  },
  {
    "word": "downward",
    "phonetic": "[ˈdaʊnwəd]",
    "meaning": "向下的"
  },
  {
    "word": "dozen",
    "phonetic": "[ˈdʌzn]",
    "meaning": "一打"
  },
  {
    "word": "draft",
    "phonetic": "[drɑːft]",
    "meaning": "草稿"
  },
  {
    "word": "drag",
    "phonetic": "[dræɡ]",
    "meaning": "拖"
  },
  {
    "word": "dragon",
    "phonetic": "[ˈdræɡən]",
    "meaning": "龙"
  },
  {
    "word": "drain",
    "phonetic": "[dreɪn]",
    "meaning": "排水"
  },
  {
    "word": "drama",
    "phonetic": "[ˈdrɑːmə]",
    "meaning": "戏剧"
  },
  {
    "word": "dramatic",
    "phonetic": "[drəˈmætɪk]",
    "meaning": "戏剧的"
  },
  {
    "word": "draw",
    "phonetic": "[drɔː]",
    "meaning": "画"
  },
  {
    "word": "drawback",
    "phonetic": "[ˈdrɔːbæk]",
    "meaning": "缺点"
  },
  {
    "word": "drawing",
    "phonetic": "[ˈdrɔːɪŋ]",
    "meaning": "绘画"
  },
  {
    "word": "dread",
    "phonetic": "[dred]",
    "meaning": "恐惧"
  },
  {
    "word": "dreadful",
    "phonetic": "[ˈdredfl]",
    "meaning": "可怕的"
  },
  {
    "word": "dream",
    "phonetic": "[driːm]",
    "meaning": "梦想"
  },
  {
    "word": "dress",
    "phonetic": "[dres]",
    "meaning": "连衣裙"
  },
  {
    "word": "drift",
    "phonetic": "[drɪft]",
    "meaning": "漂流"
  },
  {
    "word": "drill",
    "phonetic": "[drɪl]",
    "meaning": "钻孔"
  },
  {
    "word": "drink",
    "phonetic": "[drɪŋk]",
    "meaning": "喝"
  },
  {
    "word": "drip",
    "phonetic": "[drɪp]",
    "meaning": "滴水"
  },
  {
    "word": "drive",
    "phonetic": "[draɪv]",
    "meaning": "驾驶"
  },
  {
    "word": "driver",
    "phonetic": "[ˈdraɪvə(r)]",
    "meaning": "司机"
  },
  {
    "word": "drop",
    "phonetic": "[drɒp]",
    "meaning": "落下"
  },
  {
    "word": "drought",
    "phonetic": "[draʊt]",
    "meaning": "干旱"
  },
  {
    "word": "drown",
    "phonetic": "[draʊn]",
    "meaning": "淹死"
  },
  {
    "word": "drug",
    "phonetic": "[drʌɡ]",
    "meaning": "药物"
  },
  {
    "word": "drum",
    "phonetic": "[drʌm]",
    "meaning": "鼓"
  },
  {
    "word": "drunk",
    "phonetic": "[drʌŋk]",
    "meaning": "醉的"
  },
  {
    "word": "dry",
    "phonetic": "[draɪ]",
    "meaning": "干燥的"
  },
  {
    "word": "dual",
    "phonetic": "[ˈdjuːəl]",
    "meaning": "双重的"
  },
  {
    "word": "dubious",
    "phonetic": "[ˈdjuːbiəs]",
    "meaning": "可疑的"
  },
  {
    "word": "duck",
    "phonetic": "[dʌk]",
    "meaning": "鸭子"
  },
  {
    "word": "due",
    "phonetic": "[djuː]",
    "meaning": "到期的"
  },
  {
    "word": "duplicate",
    "phonetic": "[ˈdjuːplɪkeɪt]",
    "meaning": "复制"
  },
  {
    "word": "durable",
    "phonetic": "[ˈdjʊərəbl]",
    "meaning": "耐用的"
  },
  {
    "word": "duration",
    "phonetic": "[djuˈreɪʃn]",
    "meaning": "持续时间"
  },
  {
    "word": "during",
    "phonetic": "[ˈdjʊərɪŋ]",
    "meaning": "在...期间"
  },
  {
    "word": "dust",
    "phonetic": "[dʌst]",
    "meaning": "灰尘"
  },
  {
    "word": "duty",
    "phonetic": "[ˈdjuːti]",
    "meaning": "责任"
  },
  {
    "word": "dwarf",
    "phonetic": "[dwɔːf]",
    "meaning": "矮子"
  },
  {
    "word": "dynamic",
    "phonetic": "[daɪˈnæmɪk]",
    "meaning": "动态的"
  },
  {
    "word": "dynasty",
    "phonetic": "[ˈdɪnəsti]",
    "meaning": "王朝"
  },
  {
    "word": "eager",
    "phonetic": "[ˈiːɡə(r)]",
    "meaning": "渴望的"
  },
  {
    "word": "eagle",
    "phonetic": "[ˈiːɡl]",
    "meaning": "鹰"
  },
  {
    "word": "ear",
    "phonetic": "[ɪə(r)]",
    "meaning": "耳朵"
  },
  {
    "word": "earn",
    "phonetic": "[ɜːn]",
    "meaning": "赚得"
  },
  {
    "word": "earnest",
    "phonetic": "[ˈɜːnɪst]",
    "meaning": "认真的"
  },
  {
    "word": "earth",
    "phonetic": "[ɜːθ]",
    "meaning": "地球"
  },
  {
    "word": "ease",
    "phonetic": "[iːz]",
    "meaning": "容易"
  },
  {
    "word": "eastern",
    "phonetic": "[ˈiːstən]",
    "meaning": "东方的"
  },
  {
    "word": "easy",
    "phonetic": "[ˈiːzi]",
    "meaning": "容易的"
  },
  {
    "word": "dull",
    "phonetic": "[dʌl]",
    "meaning": "迟钝的"
  },
  {
    "word": "dumb",
    "phonetic": "[dʌm]",
    "meaning": "哑的"
  },
  {
    "word": "dump",
    "phonetic": "[dʌmp]",
    "meaning": "倾倒"
  },
  {
    "word": "dumpling",
    "phonetic": "[ˈdʌmplɪŋ]",
    "meaning": "饺子"
  },
  {
    "word": "dune",
    "phonetic": "[djuːn]",
    "meaning": "沙丘"
  },
  {
    "word": "dusty",
    "phonetic": "[ˈdʌsti]",
    "meaning": "多尘的"
  },
  {
    "word": "dwell",
    "phonetic": "[dwel]",
    "meaning": "居住"
  },
  {
    "word": "dwell on",
    "phonetic": "[dwel ɒn]",
    "meaning": "详述"
  },
  {
    "word": "dwelling",
    "phonetic": "[ˈdwelɪŋ]",
    "meaning": "住所"
  },
  {
    "word": "dye",
    "phonetic": "[daɪ]",
    "meaning": "染色"
  },
  {
    "word": "dying",
    "phonetic": "[ˈdaɪɪŋ]",
    "meaning": "垂死的"
  },
  {
    "word": "echo",
    "phonetic": "[ˈekəʊ]",
    "meaning": "回声"
  },
  {
    "word": "eclipse",
    "phonetic": "[ɪˈklɪps]",
    "meaning": "日食"
  },
  {
    "word": "ecology",
    "phonetic": "[iˈkɒlədʒi]",
    "meaning": "生态学"
  },
  {
    "word": "economic",
    "phonetic": "[ˌiːkəˈnɒmɪk]",
    "meaning": "经济的"
  },
  {
    "word": "economical",
    "phonetic": "[ˌiːkəˈnɒmɪkl]",
    "meaning": "节约的"
  },
  {
    "word": "economy",
    "phonetic": "[ɪˈkɒnəmi]",
    "meaning": "经济"
  },
  {
    "word": "edge",
    "phonetic": "[edʒ]",
    "meaning": "边缘"
  },
  {
    "word": "edible",
    "phonetic": "[ˈedəbl]",
    "meaning": "可食用的"
  },
  {
    "word": "edit",
    "phonetic": "[ˈedɪt]",
    "meaning": "编辑"
  },
  {
    "word": "editor",
    "phonetic": "[ˈedɪtə(r)]",
    "meaning": "编辑"
  },
  {
    "word": "educate",
    "phonetic": "[ˈedʒukeɪt]",
    "meaning": "教育"
  },
  {
    "word": "education",
    "phonetic": "[ˌedʒuˈkeɪʃn]",
    "meaning": "教育"
  },
  {
    "word": "effect",
    "phonetic": "[ɪˈfekt]",
    "meaning": "影响"
  },
  {
    "word": "effective",
    "phonetic": "[ɪˈfektɪv]",
    "meaning": "有效的"
  },
  {
    "word": "efficient",
    "phonetic": "[ɪˈfɪʃnt]",
    "meaning": "高效的"
  },
  {
    "word": "efficiency",
    "phonetic": "[ɪˈfɪʃnsi]",
    "meaning": "效率"
  },
  {
    "word": "effort",
    "phonetic": "[ˈefət]",
    "meaning": "努力"
  },
  {
    "word": "egg",
    "phonetic": "[eɡ]",
    "meaning": "鸡蛋"
  },
  {
    "word": "eighty",
    "phonetic": "[ˈeɪti]",
    "meaning": "八十"
  },
  {
    "word": "either",
    "phonetic": "[ˈaɪðə(r)]",
    "meaning": "也"
  },
  {
    "word": "elaborate",
    "phonetic": "[ɪˈlæbərət]",
    "meaning": "详细的"
  },
  {
    "word": "elastic",
    "phonetic": "[ɪˈlæstɪk]",
    "meaning": "弹性的"
  },
  {
    "word": "elbow",
    "phonetic": "[ˈelbəʊ]",
    "meaning": "肘部"
  },
  {
    "word": "elder",
    "phonetic": "[ˈeldə(r)]",
    "meaning": "年长的"
  },
  {
    "word": "elderly",
    "phonetic": "[ˈeldəli]",
    "meaning": "年长的"
  },
  {
    "word": "elect",
    "phonetic": "[ɪˈlekt]",
    "meaning": "选举"
  },
  {
    "word": "electric",
    "phonetic": "[ɪˈlektrɪk]",
    "meaning": "电的"
  },
  {
    "word": "electrical",
    "phonetic": "[ɪˈlektrɪkl]",
    "meaning": "电的"
  },
  {
    "word": "electricity",
    "phonetic": "[ɪˌlekˈtrɪsəti]",
    "meaning": "电"
  },
  {
    "word": "electron",
    "phonetic": "[ɪˈlektrɒn]",
    "meaning": "电子"
  },
  {
    "word": "elegant",
    "phonetic": "[ˈelɪɡənt]",
    "meaning": "优雅的"
  },
  {
    "word": "element",
    "phonetic": "[ˈelɪmənt]",
    "meaning": "元素"
  },
  {
    "word": "elementary",
    "phonetic": "[ˌelɪˈmentri]",
    "meaning": "基本的"
  },
  {
    "word": "elephant",
    "phonetic": "[ˈelɪfənt]",
    "meaning": "大象"
  },
  {
    "word": "elevator",
    "phonetic": "[ˈelɪveɪtə(r)]",
    "meaning": "电梯"
  },
  {
    "word": "eliminate",
    "phonetic": "[ɪˈlɪmɪneɪt]",
    "meaning": "消除"
  },
  {
    "word": "elimination",
    "phonetic": "[ɪˌlɪmɪˈneɪʃn]",
    "meaning": "消除"
  },
  {
    "word": "else",
    "phonetic": "[els]",
    "meaning": "其他"
  },
  {
    "word": "elsewhere",
    "phonetic": "[ˌelsˈweə(r)]",
    "meaning": "在别处"
  },
  {
    "word": "embarrass",
    "phonetic": "[ɪmˈbærəs]",
    "meaning": "使尴尬"
  },
  {
    "word": "embarrassment",
    "phonetic": "[ɪmˈbærəsmənt]",
    "meaning": "尴尬"
  },
  {
    "word": "embassy",
    "phonetic": "[ˈembəsi]",
    "meaning": "大使馆"
  },
  {
    "word": "embrace",
    "phonetic": "[ɪmˈbreɪs]",
    "meaning": "拥抱"
  },
  {
    "word": "emerge",
    "phonetic": "[ɪˈmɜːdʒ]",
    "meaning": "出现"
  },
  {
    "word": "emergency",
    "phonetic": "[ɪˈmɜːdʒənsi]",
    "meaning": "紧急情况"
  },
  {
    "word": "emission",
    "phonetic": "[iˈmɪʃn]",
    "meaning": "排放"
  },
  {
    "word": "emit",
    "phonetic": "[iˈmɪt]",
    "meaning": "排放"
  },
  {
    "word": "emotion",
    "phonetic": "[ɪˈməʊʃn]",
    "meaning": "情感"
  },
  {
    "word": "emotional",
    "phonetic": "[ɪˈməʊʃənl]",
    "meaning": "情感的"
  },
  {
    "word": "emphasis",
    "phonetic": "[ˈemfəsɪs]",
    "meaning": "强调"
  },
  {
    "word": "emphasize",
    "phonetic": "[ˈemfəsaɪz]",
    "meaning": "强调"
  },
  {
    "word": "employ",
    "phonetic": "[ɪmˈplɔɪ]",
    "meaning": "雇佣"
  },
  {
    "word": "employee",
    "phonetic": "[ɪmˈplɔɪiː]",
    "meaning": "雇员"
  },
  {
    "word": "employer",
    "phonetic": "[ɪmˈplɔɪə(r)]",
    "meaning": "雇主"
  },
  {
    "word": "employment",
    "phonetic": "[ɪmˈplɔɪmənt]",
    "meaning": "就业"
  },
  {
    "word": "empty",
    "phonetic": "[ˈempti]",
    "meaning": "空的"
  },
  {
    "word": "enable",
    "phonetic": "[ɪˈneɪbl]",
    "meaning": "使能够"
  },
  {
    "word": "encourage",
    "phonetic": "[ɪnˈkʌrɪdʒ]",
    "meaning": "鼓励"
  },
  {
    "word": "encouragement",
    "phonetic": "[ɪnˈkʌrɪdʒmənt]",
    "meaning": "鼓励"
  },
  {
    "word": "end",
    "phonetic": "[end]",
    "meaning": "结束"
  },
  {
    "word": "ending",
    "phonetic": "[ˈendɪŋ]",
    "meaning": "结局"
  },
  {
    "word": "endless",
    "phonetic": "[ˈendləs]",
    "meaning": "无尽的"
  },
  {
    "word": "enemy",
    "phonetic": "[ˈenəmi]",
    "meaning": "敌人"
  },
  {
    "word": "energy",
    "phonetic": "[ˈenədʒi]",
    "meaning": "能量"
  },
  {
    "word": "enforce",
    "phonetic": "[ɪnˈfɔːs]",
    "meaning": "执行"
  },
  {
    "word": "engage",
    "phonetic": "[ɪnˈɡeɪdʒ]",
    "meaning": "参与"
  },
  {
    "word": "engine",
    "phonetic": "[ˈendʒɪn]",
    "meaning": "发动机"
  },
  {
    "word": "engineer",
    "phonetic": "[ˌendʒɪˈnɪə(r)]",
    "meaning": "工程师"
  },
  {
    "word": "engineering",
    "phonetic": "[ˌendʒɪˈnɪərɪŋ]",
    "meaning": "工程"
  },
  {
    "word": "England",
    "phonetic": "[ˈɪŋɡlənd]",
    "meaning": "英格兰"
  },
  {
    "word": "English",
    "phonetic": "[ˈɪŋɡlɪʃ]",
    "meaning": "英语"
  },
  {
    "word": "enhance",
    "phonetic": "[ɪnˈhɑːns]",
    "meaning": "增强"
  },
  {
    "word": "enjoy",
    "phonetic": "[ɪnˈdʒɔɪ]",
    "meaning": "享受"
  },
  {
    "word": "enjoyable",
    "phonetic": "[ɪnˈdʒɔɪəbl]",
    "meaning": "愉快的"
  },
  {
    "word": "enlarge",
    "phonetic": "[ɪnˈlɑːdʒ]",
    "meaning": "扩大"
  },
  {
    "word": "enlighten",
    "phonetic": "[ɪnˈlaɪtn]",
    "meaning": "启发"
  },
  {
    "word": "enormous",
    "phonetic": "[ɪˈnɔːməs]",
    "meaning": "巨大的"
  },
  {
    "word": "enough",
    "phonetic": "[ɪˈnʌf]",
    "meaning": "足够的"
  },
  {
    "word": "enquire",
    "phonetic": "[ɪnˈkwaɪə(r)]",
    "meaning": "询问"
  },
  {
    "word": "enquiry",
    "phonetic": "[ɪnˈkwaɪəri]",
    "meaning": "询问"
  },
  {
    "word": "ensure",
    "phonetic": "[ɪnˈʃʊə(r)]",
    "meaning": "确保"
  },
  {
    "word": "enter",
    "phonetic": "[ˈentə(r)]",
    "meaning": "进入"
  },
  {
    "word": "enterprise",
    "phonetic": "[ˈentəpraɪz]",
    "meaning": "企业"
  },
  {
    "word": "entertain",
    "phonetic": "[ˌentəˈteɪn]",
    "meaning": "娱乐"
  },
  {
    "word": "entertainment",
    "phonetic": "[ˌentəˈteɪnmənt]",
    "meaning": "娱乐"
  },
  {
    "word": "enthusiasm",
    "phonetic": "[ɪnˈθjuːziæzəm]",
    "meaning": "热情"
  },
  {
    "word": "enthusiastic",
    "phonetic": "[ɪnˌθjuːziˈæstɪk]",
    "meaning": "热情的"
  },
  {
    "word": "entire",
    "phonetic": "[ɪnˈtaɪə(r)]",
    "meaning": "整个的"
  },
  {
    "word": "entirely",
    "phonetic": "[ɪnˈtaɪəli]",
    "meaning": "完全地"
  },
  {
    "word": "entrance",
    "phonetic": "[ˈentrəns]",
    "meaning": "入口"
  },
  {
    "word": "entry",
    "phonetic": "[ˈentri]",
    "meaning": "进入"
  },
  {
    "word": "environment",
    "phonetic": "[ɪnˈvaɪrənmənt]",
    "meaning": "环境"
  },
  {
    "word": "environmental",
    "phonetic": "[ɪnˌvaɪrənˈmentl]",
    "meaning": "环境的"
  },
  {
    "word": "envy",
    "phonetic": "[ˈenvi]",
    "meaning": "嫉妒"
  },
  {
    "word": "equal",
    "phonetic": "[ˈiːkwəl]",
    "meaning": "平等的"
  },
  {
    "word": "equality",
    "phonetic": "[iˈkwɒləti]",
    "meaning": "平等"
  },
  {
    "word": "equation",
    "phonetic": "[ɪˈkweɪʒn]",
    "meaning": "方程"
  },
  {
    "word": "equip",
    "phonetic": "[ɪˈkwɪp]",
    "meaning": "装备"
  },
  {
    "word": "equipment",
    "phonetic": "[ɪˈkwɪpmənt]",
    "meaning": "设备"
  },
  {
    "word": "equivalent",
    "phonetic": "[ɪˈkwɪvələnt]",
    "meaning": "相等的"
  },
  {
    "word": "era",
    "phonetic": "[ˈɪərə]",
    "meaning": "时代"
  },
  {
    "word": "erase",
    "phonetic": "[ɪˈreɪz]",
    "meaning": "擦除"
  },
  {
    "word": "erect",
    "phonetic": "[ɪˈrekt]",
    "meaning": "直立的"
  },
  {
    "word": "error",
    "phonetic": "[ˈerə(r)]",
    "meaning": "错误"
  },
  {
    "word": "escape",
    "phonetic": "[ɪˈskeɪp]",
    "meaning": "逃脱"
  },
  {
    "word": "especially",
    "phonetic": "[ɪˈspeʃəli]",
    "meaning": "特别"
  },
  {
    "word": "essay",
    "phonetic": "[ˈeseɪ]",
    "meaning": "散文"
  },
  {
    "word": "essential",
    "phonetic": "[ɪˈsenʃl]",
    "meaning": "必要的"
  },
  {
    "word": "essentially",
    "phonetic": "[ɪˈsenʃəli]",
    "meaning": "本质上"
  },
  {
    "word": "establish",
    "phonetic": "[ɪˈstæblɪʃ]",
    "meaning": "建立"
  },
  {
    "word": "establishment",
    "phonetic": "[ɪˈstæblɪʃmənt]",
    "meaning": "建立"
  },
  {
    "word": "estate",
    "phonetic": "[ɪˈsteɪt]",
    "meaning": "房产"
  },
  {
    "word": "estimate",
    "phonetic": "[ˈestɪmeɪt]",
    "meaning": "估计"
  },
  {
    "word": "estimation",
    "phonetic": "[ˌestɪˈmeɪʃn]",
    "meaning": "估计"
  },
  {
    "word": "etc",
    "phonetic": "[et ˈsetərə]",
    "meaning": "等等"
  },
  {
    "word": "Europe",
    "phonetic": "[ˈjʊərəp]",
    "meaning": "欧洲"
  },
  {
    "word": "European",
    "phonetic": "[ˌjʊərəˈpiːən]",
    "meaning": "欧洲的"
  },
  {
    "word": "evaluate",
    "phonetic": "[ɪˈvæljueɪt]",
    "meaning": "评价"
  },
  {
    "word": "evaluation",
    "phonetic": "[ɪˌvæljuˈeɪʃn]",
    "meaning": "评价"
  },
  {
    "word": "eve",
    "phonetic": "[iːv]",
    "meaning": "前夕"
  },
  {
    "word": "even",
    "phonetic": "[ˈiːvn]",
    "meaning": "甚至"
  },
  {
    "word": "evening",
    "phonetic": "[ˈiːvnɪŋ]",
    "meaning": "晚上"
  },
  {
    "word": "event",
    "phonetic": "[ɪˈvent]",
    "meaning": "事件"
  },
  {
    "word": "eventually",
    "phonetic": "[ɪˈventʃuəli]",
    "meaning": "最终"
  },
  {
    "word": "ever",
    "phonetic": "[ˈevə(r)]",
    "meaning": "曾经"
  },
  {
    "word": "every",
    "phonetic": "[ˈevri]",
    "meaning": "每个"
  },
  {
    "word": "everybody",
    "phonetic": "[ˈevribɒdi]",
    "meaning": "每个人"
  },
  {
    "word": "everyday",
    "phonetic": "[ˈevrideɪ]",
    "meaning": "日常的"
  },
  {
    "word": "everyone",
    "phonetic": "[ˈevriwʌn]",
    "meaning": "每个人"
  },
  {
    "word": "everything",
    "phonetic": "[ˈevriθɪŋ]",
    "meaning": "每件事"
  },
  {
    "word": "everywhere",
    "phonetic": "[ˈevriweə(r)]",
    "meaning": "到处"
  },
  {
    "word": "evidence",
    "phonetic": "[ˈevɪdəns]",
    "meaning": "证据"
  },
  {
    "word": "evident",
    "phonetic": "[ˈevɪdənt]",
    "meaning": "明显的"
  },
  {
    "word": "evil",
    "phonetic": "[ˈiːvl]",
    "meaning": "邪恶的"
  },
  {
    "word": "evolve",
    "phonetic": "[iˈvɒlv]",
    "meaning": "进化"
  },
  {
    "word": "evolution",
    "phonetic": "[ˌiːvəˈluːʃn]",
    "meaning": "进化"
  },
  {
    "word": "exact",
    "phonetic": "[ɪɡˈzækt]",
    "meaning": "精确的"
  },
  {
    "word": "exactly",
    "phonetic": "[ɪɡˈzæktli]",
    "meaning": "确切地"
  },
  {
    "word": "exaggerate",
    "phonetic": "[ɪɡˈzædʒəreɪt]",
    "meaning": "夸大"
  },
  {
    "word": "exam",
    "phonetic": "[ɪɡˈzæm]",
    "meaning": "考试"
  },
  {
    "word": "examine",
    "phonetic": "[ɪɡˈzæmɪn]",
    "meaning": "检查"
  },
  {
    "word": "examination",
    "phonetic": "[ɪɡˌzæmɪˈneɪʃn]",
    "meaning": "考试"
  },
  {
    "word": "example",
    "phonetic": "[ɪɡˈzɑːmpl]",
    "meaning": "例子"
  },
  {
    "word": "excellent",
    "phonetic": "[ˈeksələnt]",
    "meaning": "优秀的"
  },
  {
    "word": "except",
    "phonetic": "[ɪkˈsept]",
    "meaning": "除了"
  },
  {
    "word": "exception",
    "phonetic": "[ɪkˈsepʃn]",
    "meaning": "例外"
  },
  {
    "word": "excessive",
    "phonetic": "[ɪkˈsesɪv]",
    "meaning": "过多的"
  },
  {
    "word": "exchange",
    "phonetic": "[ɪksˈtʃeɪndʒ]",
    "meaning": "交换"
  },
  {
    "word": "excite",
    "phonetic": "[ɪkˈsaɪt]",
    "meaning": "使兴奋"
  },
  {
    "word": "excitement",
    "phonetic": "[ɪkˈsaɪtmənt]",
    "meaning": "兴奋"
  },
  {
    "word": "exciting",
    "phonetic": "[ɪkˈsaɪtɪŋ]",
    "meaning": "令人兴奋的"
  },
  {
    "word": "exclaim",
    "phonetic": "[ɪkˈskleɪm]",
    "meaning": "呼喊"
  },
  {
    "word": "exclude",
    "phonetic": "[ɪkˈskluːd]",
    "meaning": "排除"
  },
  {
    "word": "exclusive",
    "phonetic": "[ɪkˈskluːsɪv]",
    "meaning": "独有的"
  },
  {
    "word": "excursion",
    "phonetic": "[ɪkˈskɜːʃn]",
    "meaning": "远足"
  },
  {
    "word": "excuse",
    "phonetic": "[ɪkˈskjuːz]",
    "meaning": "借口"
  },
  {
    "word": "execute",
    "phonetic": "[ˈeksɪkjuːt]",
    "meaning": "执行"
  },
  {
    "word": "executive",
    "phonetic": "[ɪɡˈzekjətɪv]",
    "meaning": "行政的"
  },
  {
    "word": "exercise",
    "phonetic": "[ˈeksəsaɪz]",
    "meaning": "练习"
  },
  {
    "word": "exert",
    "phonetic": "[ɪɡˈzɜːt]",
    "meaning": "运用"
  },
  {
    "word": "exhaust",
    "phonetic": "[ɪɡˈzɔːst]",
    "meaning": "使筋疲力尽"
  },
  {
    "word": "exhibit",
    "phonetic": "[ɪɡˈzɪbɪt]",
    "meaning": "展览"
  },
  {
    "word": "exhibition",
    "phonetic": "[ˌeksɪˈbɪʃn]",
    "meaning": "展览"
  },
  {
    "word": "exist",
    "phonetic": "[ɪɡˈzɪst]",
    "meaning": "存在"
  },
  {
    "word": "existence",
    "phonetic": "[ɪɡˈzɪstəns]",
    "meaning": "存在"
  },
  {
    "word": "exit",
    "phonetic": "[ˈeksɪt]",
    "meaning": "出口"
  },
  {
    "word": "expand",
    "phonetic": "[ɪkˈspænd]",
    "meaning": "扩大"
  },
  {
    "word": "expansion",
    "phonetic": "[ɪkˈspænʃn]",
    "meaning": "扩张"
  },
  {
    "word": "expect",
    "phonetic": "[ɪkˈspekt]",
    "meaning": "期望"
  },
  {
    "word": "expectation",
    "phonetic": "[ˌekspekˈteɪʃn]",
    "meaning": "期望"
  },
  {
    "word": "expedition",
    "phonetic": "[ˌekspəˈdɪʃn]",
    "meaning": "远征"
  },
  {
    "word": "expense",
    "phonetic": "[ɪkˈspens]",
    "meaning": "费用"
  },
  {
    "word": "expensive",
    "phonetic": "[ɪkˈspensɪv]",
    "meaning": "昂贵的"
  },
  {
    "word": "experience",
    "phonetic": "[ɪkˈspɪəriəns]",
    "meaning": "经验"
  },
  {
    "word": "experiment",
    "phonetic": "[ɪkˈsperɪmənt]",
    "meaning": "实验"
  },
  {
    "word": "expert",
    "phonetic": "[ˈekspɜːt]",
    "meaning": "专家"
  },
  {
    "word": "explain",
    "phonetic": "[ɪkˈspleɪn]",
    "meaning": "解释"
  },
  {
    "word": "explanation",
    "phonetic": "[ˌekspləˈneɪʃn]",
    "meaning": "解释"
  },
  {
    "word": "explode",
    "phonetic": "[ɪkˈspləʊd]",
    "meaning": "爆炸"
  },
  {
    "word": "exploration",
    "phonetic": "[ˌekspləˈreɪʃn]",
    "meaning": "探索"
  },
  {
    "word": "explore",
    "phonetic": "[ɪkˈsplɔː(r)]",
    "meaning": "探索"
  },
  {
    "word": "explosion",
    "phonetic": "[ɪkˈspləʊʒn]",
    "meaning": "爆炸"
  },
  {
    "word": "explosive",
    "phonetic": "[ɪkˈspləʊsɪv]",
    "meaning": "爆炸的"
  },
  {
    "word": "export",
    "phonetic": "[ɪkˈspɔːt]",
    "meaning": "出口"
  },
  {
    "word": "expose",
    "phonetic": "[ɪkˈspəʊz]",
    "meaning": "暴露"
  },
  {
    "word": "exposure",
    "phonetic": "[ɪkˈspəʊʒə(r)]",
    "meaning": "暴露"
  },
  {
    "word": "express",
    "phonetic": "[ɪkˈspres]",
    "meaning": "表达"
  },
  {
    "word": "expression",
    "phonetic": "[ɪkˈspreʃn]",
    "meaning": "表达"
  },
  {
    "word": "extend",
    "phonetic": "[ɪkˈstend]",
    "meaning": "延长"
  },
  {
    "word": "extension",
    "phonetic": "[ɪkˈstenʃn]",
    "meaning": "延长"
  },
  {
    "word": "extensive",
    "phonetic": "[ɪkˈstensɪv]",
    "meaning": "广泛的"
  },
  {
    "word": "extent",
    "phonetic": "[ɪkˈstent]",
    "meaning": "程度"
  },
  {
    "word": "exterior",
    "phonetic": "[ɪkˈstɪəriə(r)]",
    "meaning": "外部的"
  },
  {
    "word": "external",
    "phonetic": "[ɪkˈstɜːnl]",
    "meaning": "外部的"
  },
  {
    "word": "extra",
    "phonetic": "[ˈekstrə]",
    "meaning": "额外的"
  },
  {
    "word": "extract",
    "phonetic": "[ɪkˈstrækt]",
    "meaning": "提取"
  },
  {
    "word": "extraordinary",
    "phonetic": "[ɪkˈstrɔːdnri]",
    "meaning": "非凡的"
  },
  {
    "word": "extreme",
    "phonetic": "[ɪkˈstriːm]",
    "meaning": "极端的"
  },
  {
    "word": "extremely",
    "phonetic": "[ɪkˈstriːmli]",
    "meaning": "极其"
  },
  {
    "word": "eye",
    "phonetic": "[aɪ]",
    "meaning": "眼睛"
  },
  {
    "word": "eyebrow",
    "phonetic": "[ˈaɪbraʊ]",
    "meaning": "眉毛"
  },
  {
    "word": "eyesight",
    "phonetic": "[ˈaɪsaɪt]",
    "meaning": "视力"
  },
  {
    "word": "face",
    "phonetic": "[feɪs]",
    "meaning": "脸"
  },
  {
    "word": "facility",
    "phonetic": "[fəˈsɪləti]",
    "meaning": "设施"
  },
  {
    "word": "fact",
    "phonetic": "[fækt]",
    "meaning": "事实"
  },
  {
    "word": "factor",
    "phonetic": "[ˈfæktə(r)]",
    "meaning": "因素"
  },
  {
    "word": "factory",
    "phonetic": "[ˈfæktri]",
    "meaning": "工厂"
  },
  {
    "word": "faculty",
    "phonetic": "[ˈfæklti]",
    "meaning": "能力"
  },
  {
    "word": "fade",
    "phonetic": "[feɪd]",
    "meaning": "褪色"
  },
  {
    "word": "fail",
    "phonetic": "[feɪl]",
    "meaning": "失败"
  },
  {
    "word": "failure",
    "phonetic": "[ˈfeɪljə(r)]",
    "meaning": "失败"
  },
  {
    "word": "fair",
    "phonetic": "[feə(r)]",
    "meaning": "公平的"
  },
  {
    "word": "fairly",
    "phonetic": "[ˈfeəli]",
    "meaning": "相当"
  },
  {
    "word": "faith",
    "phonetic": "[feɪθ]",
    "meaning": "信仰"
  },
  {
    "word": "faithful",
    "phonetic": "[ˈfeɪθfl]",
    "meaning": "忠诚的"
  },
  {
    "word": "fall",
    "phonetic": "[fɔːl]",
    "meaning": "落下"
  },
  {
    "word": "false",
    "phonetic": "[fɔːls]",
    "meaning": "错误的"
  },
  {
    "word": "fame",
    "phonetic": "[feɪm]",
    "meaning": "名声"
  },
  {
    "word": "familiar",
    "phonetic": "[fəˈmɪliə(r)]",
    "meaning": "熟悉的"
  },
  {
    "word": "family",
    "phonetic": "[ˈfæməli]",
    "meaning": "家庭"
  },
  {
    "word": "famine",
    "phonetic": "[ˈfæmɪn]",
    "meaning": "饥荒"
  },
  {
    "word": "famous",
    "phonetic": "[ˈfeɪməs]",
    "meaning": "著名的"
  },
  {
    "word": "fan",
    "phonetic": "[fæn]",
    "meaning": "粉丝"
  },
  {
    "word": "fancy",
    "phonetic": "[ˈfænsi]",
    "meaning": "幻想"
  },
  {
    "word": "fantastic",
    "phonetic": "[fænˈtæstɪk]",
    "meaning": "极好的"
  },
  {
    "word": "fantasy",
    "phonetic": "[ˈfæntəsi]",
    "meaning": "幻想"
  },
  {
    "word": "far",
    "phonetic": "[fɑː(r)]",
    "meaning": "远的"
  },
  {
    "word": "fare",
    "phonetic": "[feə(r)]",
    "meaning": "票价"
  },
  {
    "word": "farewell",
    "phonetic": "[ˌfeəˈwel]",
    "meaning": "告别"
  },
  {
    "word": "farm",
    "phonetic": "[fɑːm]",
    "meaning": "农场"
  },
  {
    "word": "farmer",
    "phonetic": "[ˈfɑːmə(r)]",
    "meaning": "农民"
  },
  {
    "word": "farming",
    "phonetic": "[ˈfɑːmɪŋ]",
    "meaning": "农业"
  },
  {
    "word": "farther",
    "phonetic": "[ˈfɑːðə(r)]",
    "meaning": "更远的"
  },
  {
    "word": "fashion",
    "phonetic": "[ˈfæʃn]",
    "meaning": "时尚"
  },
  {
    "word": "fashionable",
    "phonetic": "[ˈfæʃnəbl]",
    "meaning": "时尚的"
  },
  {
    "word": "fast",
    "phonetic": "[fɑːst]",
    "meaning": "快的"
  },
  {
    "word": "fasten",
    "phonetic": "[ˈfɑːsn]",
    "meaning": "系牢"
  },
  {
    "word": "fat",
    "phonetic": "[fæt]",
    "meaning": "胖的"
  },
  {
    "word": "fatal",
    "phonetic": "[ˈfeɪtl]",
    "meaning": "致命的"
  },
  {
    "word": "fate",
    "phonetic": "[feɪt]",
    "meaning": "命运"
  },
  {
    "word": "father",
    "phonetic": "[ˈfɑːðə(r)]",
    "meaning": "父亲"
  },
  {
    "word": "fault",
    "phonetic": "[fɔːlt]",
    "meaning": "过错"
  },
  {
    "word": "faulty",
    "phonetic": "[ˈfɔːlti]",
    "meaning": "有错误的"
  },
  {
    "word": "favor",
    "phonetic": "[ˈfeɪvə(r)]",
    "meaning": "偏爱"
  },
  {
    "word": "favorable",
    "phonetic": "[ˈfeɪvərəbl]",
    "meaning": "有利的"
  },
  {
    "word": "favorite",
    "phonetic": "[ˈfeɪvərɪt]",
    "meaning": "最喜欢的"
  },
  {
    "word": "fax",
    "phonetic": "[fæks]",
    "meaning": "传真"
  },
  {
    "word": "fear",
    "phonetic": "[fɪə(r)]",
    "meaning": "恐惧"
  },
  {
    "word": "fearful",
    "phonetic": "[ˈfɪəfl]",
    "meaning": "可怕的"
  },
  {
    "word": "feast",
    "phonetic": "[fiːst]",
    "meaning": "盛宴"
  },
  {
    "word": "feat",
    "phonetic": "[fiːt]",
    "meaning": "功绩"
  },
  {
    "word": "feature",
    "phonetic": "[ˈfiːtʃə(r)]",
    "meaning": "特征"
  },
  {
    "word": "February",
    "phonetic": "[ˈfebruəri]",
    "meaning": "二月"
  },
  {
    "word": "federal",
    "phonetic": "[ˈfedərəl]",
    "meaning": "联邦的"
  },
  {
    "word": "fee",
    "phonetic": "[fiː]",
    "meaning": "费用"
  },
  {
    "word": "feed",
    "phonetic": "[fiːd]",
    "meaning": "喂养"
  },
  {
    "word": "feedback",
    "phonetic": "[ˈfiːdbæk]",
    "meaning": "反馈"
  },
  {
    "word": "feel",
    "phonetic": "[fiːl]",
    "meaning": "感觉"
  },
  {
    "word": "feeling",
    "phonetic": "[ˈfiːlɪŋ]",
    "meaning": "感觉"
  },
  {
    "word": "fellow",
    "phonetic": "[ˈfeləʊ]",
    "meaning": "家伙"
  },
  {
    "word": "fellowship",
    "phonetic": "[ˈfeləʊʃɪp]",
    "meaning": "友谊"
  },
  {
    "word": "female",
    "phonetic": "[ˈfiːmeɪl]",
    "meaning": "女性的"
  },
  {
    "word": "fence",
    "phonetic": "[fens]",
    "meaning": "栅栏"
  },
  {
    "word": "fertilizer",
    "phonetic": "[ˈfɜːtəlaɪzə(r)]",
    "meaning": "肥料"
  },
  {
    "word": "festival",
    "phonetic": "[ˈfestɪvl]",
    "meaning": "节日"
  },
  {
    "word": "fetch",
    "phonetic": "[fetʃ]",
    "meaning": "取来"
  },
  {
    "word": "fever",
    "phonetic": "[ˈfiːvə(r)]",
    "meaning": "发烧"
  },
  {
    "word": "few",
    "phonetic": "[fjuː]",
    "meaning": "少数的"
  },
  {
    "word": "fiber",
    "phonetic": "[ˈfaɪbə(r)]",
    "meaning": "纤维"
  },
  {
    "word": "fiction",
    "phonetic": "[ˈfɪkʃn]",
    "meaning": "小说"
  },
  {
    "word": "field",
    "phonetic": "[fiːld]",
    "meaning": "田野"
  },
  {
    "word": "fierce",
    "phonetic": "[fɪəs]",
    "meaning": "凶猛的"
  },
  {
    "word": "fifteen",
    "phonetic": "[ˌfɪfˈtiːn]",
    "meaning": "十五"
  },
  {
    "word": "fifth",
    "phonetic": "[fɪfθ]",
    "meaning": "第五"
  },
  {
    "word": "fifty",
    "phonetic": "[ˈfɪfti]",
    "meaning": "五十"
  },
  {
    "word": "fight",
    "phonetic": "[faɪt]",
    "meaning": "战斗"
  },
  {
    "word": "fighter",
    "phonetic": "[ˈfaɪtə(r)]",
    "meaning": "战士"
  },
  {
    "word": "figure",
    "phonetic": "[ˈfɪɡə(r)]",
    "meaning": "数字"
  },
  {
    "word": "file",
    "phonetic": "[faɪl]",
    "meaning": "文件"
  },
  {
    "word": "fill",
    "phonetic": "[fɪl]",
    "meaning": "填满"
  },
  {
    "word": "film",
    "phonetic": "[fɪlm]",
    "meaning": "电影"
  },
  {
    "word": "filter",
    "phonetic": "[ˈfɪltə(r)]",
    "meaning": "过滤器"
  },
  {
    "word": "final",
    "phonetic": "[ˈfaɪnl]",
    "meaning": "最终的"
  },
  {
    "word": "finally",
    "phonetic": "[ˈfaɪnəli]",
    "meaning": "最终"
  },
  {
    "word": "finance",
    "phonetic": "[ˈfaɪnæns]",
    "meaning": "金融"
  },
  {
    "word": "financial",
    "phonetic": "[faɪˈnænʃl]",
    "meaning": "金融的"
  },
  {
    "word": "find",
    "phonetic": "[faɪnd]",
    "meaning": "找到"
  },
  {
    "word": "finding",
    "phonetic": "[ˈfaɪndɪŋ]",
    "meaning": "发现"
  },
  {
    "word": "fine",
    "phonetic": "[faɪn]",
    "meaning": "好的"
  },
  {
    "word": "finger",
    "phonetic": "[ˈfɪŋɡə(r)]",
    "meaning": "手指"
  },
  {
    "word": "finish",
    "phonetic": "[ˈfɪnɪʃ]",
    "meaning": "完成"
  },
  {
    "word": "fire",
    "phonetic": "[ˈfaɪə(r)]",
    "meaning": "火"
  },
  {
    "word": "fireworks",
    "phonetic": "[ˈfaɪəwɜːks]",
    "meaning": "烟花"
  },
  {
    "word": "firm",
    "phonetic": "[fɜːm]",
    "meaning": "公司"
  },
  {
    "word": "first",
    "phonetic": "[fɜːst]",
    "meaning": "第一"
  },
  {
    "word": "fish",
    "phonetic": "[fɪʃ]",
    "meaning": "鱼"
  },
  {
    "word": "fisherman",
    "phonetic": "[ˈfɪʃəmən]",
    "meaning": "渔夫"
  },
  {
    "word": "fit",
    "phonetic": "[fɪt]",
    "meaning": "适合"
  },
  {
    "word": "fitness",
    "phonetic": "[ˈfɪtnəs]",
    "meaning": "健康"
  },
  {
    "word": "fix",
    "phonetic": "[fɪks]",
    "meaning": "修理"
  },
  {
    "word": "fixed",
    "phonetic": "[fɪkst]",
    "meaning": "固定的"
  },
  {
    "word": "flame",
    "phonetic": "[fleɪm]",
    "meaning": "火焰"
  },
  {
    "word": "flash",
    "phonetic": "[flæʃ]",
    "meaning": "闪光"
  },
  {
    "word": "flat",
    "phonetic": "[flæt]",
    "meaning": "平坦的"
  },
  {
    "word": "flavor",
    "phonetic": "[ˈfleɪvə(r)]",
    "meaning": "味道"
  },
  {
    "word": "flee",
    "phonetic": "[fliː]",
    "meaning": "逃离"
  },
  {
    "word": "flesh",
    "phonetic": "[fleʃ]",
    "meaning": "肉"
  },
  {
    "word": "flight",
    "phonetic": "[flaɪt]",
    "meaning": "飞行"
  },
  {
    "word": "float",
    "phonetic": "[fləʊt]",
    "meaning": "漂浮"
  },
  {
    "word": "flood",
    "phonetic": "[flʌd]",
    "meaning": "洪水"
  },
  {
    "word": "floor",
    "phonetic": "[flɔː(r)]",
    "meaning": "地板"
  },
  {
    "word": "flour",
    "phonetic": "[ˈflaʊə(r)]",
    "meaning": "面粉"
  },
  {
    "word": "flow",
    "phonetic": "[fləʊ]",
    "meaning": "流动"
  },
  {
    "word": "flower",
    "phonetic": "[ˈflaʊə(r)]",
    "meaning": "花"
  },
  {
    "word": "fluent",
    "phonetic": "[ˈfluːənt]",
    "meaning": "流利的"
  },
  {
    "word": "fluid",
    "phonetic": "[ˈfluːɪd]",
    "meaning": "液体"
  },
  {
    "word": "flush",
    "phonetic": "[flʌʃ]",
    "meaning": "冲洗"
  },
  {
    "word": "focus",
    "phonetic": "[ˈfəʊkəs]",
    "meaning": "焦点"
  },
  {
    "word": "fog",
    "phonetic": "[fɒɡ]",
    "meaning": "雾"
  },
  {
    "word": "fold",
    "phonetic": "[fəʊld]",
    "meaning": "折叠"
  },
  {
    "word": "folk",
    "phonetic": "[fəʊk]",
    "meaning": "人们"
  },
  {
    "word": "follow",
    "phonetic": "[ˈfɒləʊ]",
    "meaning": "跟随"
  },
  {
    "word": "following",
    "phonetic": "[ˈfɒləʊɪŋ]",
    "meaning": "接下来的"
  },
  {
    "word": "fond",
    "phonetic": "[fɒnd]",
    "meaning": "喜爱的"
  },
  {
    "word": "food",
    "phonetic": "[fuːd]",
    "meaning": "食物"
  },
  {
    "word": "fool",
    "phonetic": "[fuːl]",
    "meaning": "傻瓜"
  },
  {
    "word": "foolish",
    "phonetic": "[ˈfuːlɪʃ]",
    "meaning": "愚蠢的"
  },
  {
    "word": "foot",
    "phonetic": "[fʊt]",
    "meaning": "脚"
  },
  {
    "word": "football",
    "phonetic": "[ˈfʊtbɔːl]",
    "meaning": "足球"
  },
  {
    "word": "footprint",
    "phonetic": "[ˈfʊtprɪnt]",
    "meaning": "脚印"
  },
  {
    "word": "for",
    "phonetic": "[fɔː(r)]",
    "meaning": "为了"
  },
  {
    "word": "force",
    "phonetic": "[fɔːs]",
    "meaning": "力"
  },
  {
    "word": "forecast",
    "phonetic": "[ˈfɔːkɑːst]",
    "meaning": "预报"
  },
  {
    "word": "forehead",
    "phonetic": "[ˈfɒrɪd]",
    "meaning": "额头"
  },
  {
    "word": "foreign",
    "phonetic": "[ˈfɒrən]",
    "meaning": "外国的"
  },
  {
    "word": "foreigner",
    "phonetic": "[ˈfɒrənə(r)]",
    "meaning": "外国人"
  },
  {
    "word": "forest",
    "phonetic": "[ˈfɒrɪst]",
    "meaning": "森林"
  },
  {
    "word": "forever",
    "phonetic": "[fəˈrevə(r)]",
    "meaning": "永远"
  },
  {
    "word": "forge",
    "phonetic": "[fɔːdʒ]",
    "meaning": "伪造"
  },
  {
    "word": "forget",
    "phonetic": "[fəˈɡet]",
    "meaning": "忘记"
  },
  {
    "word": "forgive",
    "phonetic": "[fəˈɡɪv]",
    "meaning": "原谅"
  },
  {
    "word": "forgiveable",
    "phonetic": "[fəˈɡɪvəbl]",
    "meaning": "可原谅的"
  },
  {
    "word": "fork",
    "phonetic": "[fɔːk]",
    "meaning": "叉子"
  },
  {
    "word": "formal",
    "phonetic": "[ˈfɔːml]",
    "meaning": "正式的"
  },
  {
    "word": "format",
    "phonetic": "[ˈfɔːmæt]",
    "meaning": "格式"
  },
  {
    "word": "formation",
    "phonetic": "[fɔːˈmeɪʃn]",
    "meaning": "形成"
  },
  {
    "word": "former",
    "phonetic": "[ˈfɔːmə(r)]",
    "meaning": "前者的"
  },
  {
    "word": "formula",
    "phonetic": "[ˈfɔːmjələ]",
    "meaning": "公式"
  },
  {
    "word": "forth",
    "phonetic": "[fɔːθ]",
    "meaning": "向前"
  },
  {
    "word": "fortune",
    "phonetic": "[ˈfɔːtʃuːn]",
    "meaning": "运气"
  },
  {
    "word": "forum",
    "phonetic": "[ˈfɔːrəm]",
    "meaning": "论坛"
  },
  {
    "word": "forward",
    "phonetic": "[ˈfɔːwəd]",
    "meaning": "向前的"
  },
  {
    "word": "fossil",
    "phonetic": "[ˈfɒsl]",
    "meaning": "化石"
  },
  {
    "word": "foster",
    "phonetic": "[ˈfɒstə(r)]",
    "meaning": "培养"
  },
  {
    "word": "found",
    "phonetic": "[faʊnd]",
    "meaning": "建立"
  },
  {
    "word": "foundation",
    "phonetic": "[faʊnˈdeɪʃn]",
    "meaning": "基础"
  },
  {
    "word": "fountain",
    "phonetic": "[ˈfaʊntən]",
    "meaning": "喷泉"
  },
  {
    "word": "four",
    "phonetic": "[fɔː(r)]",
    "meaning": "四"
  },
  {
    "word": "fourteen",
    "phonetic": "[ˌfɔːˈtiːn]",
    "meaning": "十四"
  },
  {
    "word": "fourth",
    "phonetic": "[fɔːθ]",
    "meaning": "第四"
  },
  {
    "word": "fox",
    "phonetic": "[fɒks]",
    "meaning": "狐狸"
  },
  {
    "word": "fraction",
    "phonetic": "[ˈfrækʃn]",
    "meaning": "分数"
  },
  {
    "word": "fragment",
    "phonetic": "[ˈfræɡmənt]",
    "meaning": "碎片"
  },
  {
    "word": "frame",
    "phonetic": "[freɪm]",
    "meaning": "框架"
  },
  {
    "word": "framework",
    "phonetic": "[ˈfreɪmwɜːk]",
    "meaning": "框架"
  },
  {
    "word": "frank",
    "phonetic": "[fræŋk]",
    "meaning": "坦率的"
  },
  {
    "word": "free",
    "phonetic": "[friː]",
    "meaning": "自由的"
  },
  {
    "word": "freedom",
    "phonetic": "[ˈfriːdəm]",
    "meaning": "自由"
  },
  {
    "word": "freeze",
    "phonetic": "[friːz]",
    "meaning": "冻结"
  },
  {
    "word": "frequency",
    "phonetic": "[ˈfriːkwənsi]",
    "meaning": "频率"
  },
  {
    "word": "frequent",
    "phonetic": "[ˈfriːkwənt]",
    "meaning": "频繁的"
  },
  {
    "word": "fresh",
    "phonetic": "[freʃ]",
    "meaning": "新鲜的"
  },
  {
    "word": "friction",
    "phonetic": "[ˈfrɪkʃn]",
    "meaning": "摩擦"
  },
  {
    "word": "Friday",
    "phonetic": "[ˈfraɪdeɪ]",
    "meaning": "星期五"
  },
  {
    "word": "fridge",
    "phonetic": "[frɪdʒ]",
    "meaning": "冰箱"
  },
  {
    "word": "friend",
    "phonetic": "[frend]",
    "meaning": "朋友"
  },
  {
    "word": "friendship",
    "phonetic": "[ˈfrendʃɪp]",
    "meaning": "友谊"
  },
  {
    "word": "frighten",
    "phonetic": "[ˈfraɪtn]",
    "meaning": "使害怕"
  },
  {
    "word": "frightening",
    "phonetic": "[ˈfraɪtnɪŋ]",
    "meaning": "令人害怕的"
  },
  {
    "word": "frog",
    "phonetic": "[frɒɡ]",
    "meaning": "青蛙"
  },
  {
    "word": "from",
    "phonetic": "[frɒm]",
    "meaning": "从"
  },
  {
    "word": "front",
    "phonetic": "[frʌnt]",
    "meaning": "前面"
  },
  {
    "word": "frontier",
    "phonetic": "[ˈfrʌntɪə(r)]",
    "meaning": "边境"
  },
  {
    "word": "frost",
    "phonetic": "[frɒst]",
    "meaning": "霜"
  },
  {
    "word": "frown",
    "phonetic": "[fraʊn]",
    "meaning": "皱眉"
  },
  {
    "word": "fruit",
    "phonetic": "[fruːt]",
    "meaning": "水果"
  },
  {
    "word": "frustration",
    "phonetic": "[frʌˈstreɪʃn]",
    "meaning": "挫折"
  },
  {
    "word": "fry",
    "phonetic": "[fraɪ]",
    "meaning": "煎"
  },
  {
    "word": "fuel",
    "phonetic": "[ˈfjuːəl]",
    "meaning": "燃料"
  },
  {
    "word": "function",
    "phonetic": "[ˈfʌŋkʃn]",
    "meaning": "功能"
  },
  {
    "word": "functional",
    "phonetic": "[ˈfʌŋkʃənl]",
    "meaning": "功能的"
  },
  {
    "word": "fund",
    "phonetic": "[fʌnd]",
    "meaning": "基金"
  },
  {
    "word": "fundamental",
    "phonetic": "[ˌfʌndəˈmentl]",
    "meaning": "基本的"
  },
  {
    "word": "funeral",
    "phonetic": "[ˈfjuːnərəl]",
    "meaning": "葬礼"
  },
  {
    "word": "funny",
    "phonetic": "[ˈfʌni]",
    "meaning": "有趣的"
  },
  {
    "word": "fur",
    "phonetic": "[fɜː(r)]",
    "meaning": "毛皮"
  },
  {
    "word": "further",
    "phonetic": "[ˈfɜːðə(r)]",
    "meaning": "进一步"
  },
  {
    "word": "furthermore",
    "phonetic": "[ˌfɜːðəˈmɔː(r)]",
    "meaning": "此外"
  },
  {
    "word": "furniture",
    "phonetic": "[ˈfɜːnɪtʃə(r)]",
    "meaning": "家具"
  },
  {
    "word": "future",
    "phonetic": "[ˈfjuːtʃə(r)]",
    "meaning": "未来"
  },
  {
    "word": "gain",
    "phonetic": "[ɡeɪn]",
    "meaning": "获得"
  },
  {
    "word": "galaxy",
    "phonetic": "[ˈɡæləksi]",
    "meaning": "星系"
  },
  {
    "word": "gallery",
    "phonetic": "[ˈɡæləri]",
    "meaning": "画廊"
  },
  {
    "word": "gallon",
    "phonetic": "[ˈɡælən]",
    "meaning": "加仑"
  },
  {
    "word": "game",
    "phonetic": "[ɡeɪm]",
    "meaning": "游戏"
  },
  {
    "word": "gang",
    "phonetic": "[ɡæŋ]",
    "meaning": "团伙"
  },
  {
    "word": "gap",
    "phonetic": "[ɡæp]",
    "meaning": "差距"
  },
  {
    "word": "garage",
    "phonetic": "[ˈɡærɑːʒ]",
    "meaning": "车库"
  },
  {
    "word": "garden",
    "phonetic": "[ˈɡɑːdn]",
    "meaning": "花园"
  },
  {
    "word": "garlic",
    "phonetic": "[ˈɡɑːlɪk]",
    "meaning": "大蒜"
  },
  {
    "word": "garment",
    "phonetic": "[ˈɡɑːmənt]",
    "meaning": "衣服"
  },
  {
    "word": "gas",
    "phonetic": "[ɡæs]",
    "meaning": "气体"
  },
  {
    "word": "gaseous",
    "phonetic": "[ˈɡæsiəs]",
    "meaning": "气态的"
  },
  {
    "word": "gather",
    "phonetic": "[ˈɡæðə(r)]",
    "meaning": "聚集"
  },
  {
    "word": "gay",
    "phonetic": "[ɡeɪ]",
    "meaning": "同性恋的"
  },
  {
    "word": "gaze",
    "phonetic": "[ɡeɪz]",
    "meaning": "凝视"
  },
  {
    "word": "general",
    "phonetic": "[ˈdʒenrəl]",
    "meaning": "一般的"
  },
  {
    "word": "generally",
    "phonetic": "[ˈdʒenrəli]",
    "meaning": "通常"
  },
  {
    "word": "generate",
    "phonetic": "[ˈdʒenəreɪt]",
    "meaning": "产生"
  },
  {
    "word": "generation",
    "phonetic": "[ˌdʒenəˈreɪʃn]",
    "meaning": "一代"
  },
  {
    "word": "generator",
    "phonetic": "[ˈdʒenəreɪtə(r)]",
    "meaning": "发电机"
  },
  {
    "word": "generous",
    "phonetic": "[ˈdʒenərəs]",
    "meaning": "慷慨的"
  },
  {
    "word": "genetic",
    "phonetic": "[dʒəˈnetɪk]",
    "meaning": "遗传的"
  },
  {
    "word": "genius",
    "phonetic": "[ˈdʒiːniəs]",
    "meaning": "天才"
  },
  {
    "word": "gentle",
    "phonetic": "[ˈdʒentl]",
    "meaning": "温柔的"
  },
  {
    "word": "gentleman",
    "phonetic": "[ˈdʒentlmən]",
    "meaning": "绅士"
  },
  {
    "word": "genuine",
    "phonetic": "[ˈdʒenjuɪn]",
    "meaning": "真正的"
  },
  {
    "word": "geography",
    "phonetic": "[dʒiˈɒɡrəfi]",
    "meaning": "地理"
  },
  {
    "word": "geometry",
    "phonetic": "[dʒiˈɒmətri]",
    "meaning": "几何"
  },
  {
    "word": "germ",
    "phonetic": "[dʒɜːm]",
    "meaning": "细菌"
  },
  {
    "word": "gesture",
    "phonetic": "[ˈdʒestʃə(r)]",
    "meaning": "手势"
  },
  {
    "word": "get",
    "phonetic": "[ɡet]",
    "meaning": "得到"
  },
  {
    "word": "gift",
    "phonetic": "[ɡɪft]",
    "meaning": "礼物"
  },
  {
    "word": "gifted",
    "phonetic": "[ˈɡɪftɪd]",
    "meaning": "有天赋的"
  },
  {
    "word": "giraffe",
    "phonetic": "[dʒəˈræf]",
    "meaning": "长颈鹿"
  },
  {
    "word": "girl",
    "phonetic": "[ɡɜːl]",
    "meaning": "女孩"
  },
  {
    "word": "give",
    "phonetic": "[ɡɪv]",
    "meaning": "给"
  },
  {
    "word": "given",
    "phonetic": "[ˈɡɪvn]",
    "meaning": "给予的"
  },
  {
    "word": "glad",
    "phonetic": "[ɡlæd]",
    "meaning": "高兴的"
  },
  {
    "word": "glance",
    "phonetic": "[ɡlɑːns]",
    "meaning": "一瞥"
  },
  {
    "word": "glasses",
    "phonetic": "[ˈɡlɑːsɪz]",
    "meaning": "眼镜"
  },
  {
    "word": "global",
    "phonetic": "[ˈɡləʊbl]",
    "meaning": "全球的"
  },
  {
    "word": "globe",
    "phonetic": "[ɡləʊb]",
    "meaning": "地球"
  },
  {
    "word": "glove",
    "phonetic": "[ɡlʌv]",
    "meaning": "手套"
  },
  {
    "word": "glow",
    "phonetic": "[ɡləʊ]",
    "meaning": "发光"
  },
  {
    "word": "glue",
    "phonetic": "[ɡluː]",
    "meaning": "胶水"
  },
  {
    "word": "go",
    "phonetic": "[ɡəʊ]",
    "meaning": "去"
  },
  {
    "word": "goal",
    "phonetic": "[ɡəʊl]",
    "meaning": "目标"
  },
  {
    "word": "goat",
    "phonetic": "[ɡəʊt]",
    "meaning": "山羊"
  },
  {
    "word": "god",
    "phonetic": "[ɡɒd]",
    "meaning": "上帝"
  },
  {
    "word": "gold",
    "phonetic": "[ɡəʊld]",
    "meaning": "黄金"
  },
  {
    "word": "golden",
    "phonetic": "[ˈɡəʊldən]",
    "meaning": "金色的"
  },
  {
    "word": "golf",
    "phonetic": "[ɡɒlf]",
    "meaning": "高尔夫"
  },
  {
    "word": "good",
    "phonetic": "[ɡʊd]",
    "meaning": "好的"
  },
  {
    "word": "goodbye",
    "phonetic": "[ˌɡʊdˈbaɪ]",
    "meaning": "再见"
  },
  {
    "word": "goods",
    "phonetic": "[ɡʊdz]",
    "meaning": "商品"
  },
  {
    "word": "goose",
    "phonetic": "[ɡuːs]",
    "meaning": "鹅"
  },
  {
    "word": "gorge",
    "phonetic": "[ɡɔːdʒ]",
    "meaning": "峡谷"
  },
  {
    "word": "gorgeous",
    "phonetic": "[ˈɡɔːdʒəs]",
    "meaning": "华丽的"
  },
  {
    "word": "gossip",
    "phonetic": "[ˈɡɒsɪp]",
    "meaning": "八卦"
  },
  {
    "word": "govern",
    "phonetic": "[ˈɡʌvən]",
    "meaning": "统治"
  },
  {
    "word": "government",
    "phonetic": "[ˈɡʌvənmənt]",
    "meaning": "政府"
  },
  {
    "word": "governor",
    "phonetic": "[ˈɡʌvənə(r)]",
    "meaning": "州长"
  },
  {
    "word": "grab",
    "phonetic": "[ɡræb]",
    "meaning": "抓住"
  },
  {
    "word": "grace",
    "phonetic": "[ɡreɪs]",
    "meaning": "优雅"
  },
  {
    "word": "graceful",
    "phonetic": "[ˈɡreɪsfl]",
    "meaning": "优雅的"
  },
  {
    "word": "grade",
    "phonetic": "[ɡreɪd]",
    "meaning": "年级"
  },
  {
    "word": "gradually",
    "phonetic": "[ˈɡrædʒuəli]",
    "meaning": "逐渐地"
  },
  {
    "word": "graduate",
    "phonetic": "[ˈɡrædʒueɪt]",
    "meaning": "毕业"
  },
  {
    "word": "graduation",
    "phonetic": "[ˌɡrædʒuˈeɪʃn]",
    "meaning": "毕业"
  },
  {
    "word": "grain",
    "phonetic": "[ɡreɪn]",
    "meaning": "谷物"
  },
  {
    "word": "gram",
    "phonetic": "[ɡræm]",
    "meaning": "克"
  },
  {
    "word": "grammar",
    "phonetic": "[ˈɡræmə(r)]",
    "meaning": "语法"
  },
  {
    "word": "grand",
    "phonetic": "[ɡrænd]",
    "meaning": "宏伟的"
  },
  {
    "word": "granddaughter",
    "phonetic": "[ˈɡrændɔːtə(r)]",
    "meaning": "孙女"
  },
  {
    "word": "grandfather",
    "phonetic": "[ˈɡrændfɑːðə(r)]",
    "meaning": "祖父"
  },
  {
    "word": "grandmother",
    "phonetic": "[ˈɡrændmʌðə(r)]",
    "meaning": "祖母"
  },
  {
    "word": "grandson",
    "phonetic": "[ˈɡrændsʌn]",
    "meaning": "孙子"
  },
  {
    "word": "grant",
    "phonetic": "[ɡrɑːnt]",
    "meaning": "授予"
  },
  {
    "word": "grape",
    "phonetic": "[ɡreɪp]",
    "meaning": "葡萄"
  },
  {
    "word": "graph",
    "phonetic": "[ɡrɑːf]",
    "meaning": "图表"
  },
  {
    "word": "grasp",
    "phonetic": "[ɡrɑːsp]",
    "meaning": "抓住"
  },
  {
    "word": "grass",
    "phonetic": "[ɡrɑːs]",
    "meaning": "草"
  },
  {
    "word": "grateful",
    "phonetic": "[ˈɡreɪtfl]",
    "meaning": "感激的"
  },
  {
    "word": "gratitude",
    "phonetic": "[ˈɡrætɪtjuːd]",
    "meaning": "感激"
  },
  {
    "word": "grave",
    "phonetic": "[ɡreɪv]",
    "meaning": "坟墓"
  },
  {
    "word": "gravity",
    "phonetic": "[ˈɡrævəti]",
    "meaning": "重力"
  },
  {
    "word": "gray",
    "phonetic": "[ɡreɪ]",
    "meaning": "灰色的"
  },
  {
    "word": "great",
    "phonetic": "[ɡreɪt]",
    "meaning": "伟大的"
  },
  {
    "word": "greatly",
    "phonetic": "[ˈɡreɪtli]",
    "meaning": "非常"
  },
  {
    "word": "greedy",
    "phonetic": "[ˈɡriːdi]",
    "meaning": "贪婪的"
  },
  {
    "word": "Greek",
    "phonetic": "[ɡriːk]",
    "meaning": "希腊的"
  },
  {
    "word": "green",
    "phonetic": "[ɡriːn]",
    "meaning": "绿色的"
  },
  {
    "word": "greet",
    "phonetic": "[ɡriːt]",
    "meaning": "问候"
  },
  {
    "word": "greeting",
    "phonetic": "[ˈɡriːtɪŋ]",
    "meaning": "问候"
  },
  {
    "word": "grey",
    "phonetic": "[ɡreɪ]",
    "meaning": "灰色的"
  },
  {
    "word": "grief",
    "phonetic": "[ɡriːf]",
    "meaning": "悲伤"
  },
  {
    "word": "grill",
    "phonetic": "[ɡrɪl]",
    "meaning": "烧烤"
  },
  {
    "word": "grim",
    "phonetic": "[ɡrɪm]",
    "meaning": "严峻的"
  },
  {
    "word": "grin",
    "phonetic": "[ɡrɪn]",
    "meaning": "露齿笑"
  },
  {
    "word": "grind",
    "phonetic": "[ɡraɪnd]",
    "meaning": "磨碎"
  },
  {
    "word": "grip",
    "phonetic": "[ɡrɪp]",
    "meaning": "抓住"
  },
  {
    "word": "grocer",
    "phonetic": "[ˈɡrəʊsə(r)]",
    "meaning": "杂货商"
  },
  {
    "word": "grocery",
    "phonetic": "[ˈɡrəʊsəri]",
    "meaning": "杂货"
  },
  {
    "word": "ground",
    "phonetic": "[ɡraʊnd]",
    "meaning": "地面"
  },
  {
    "word": "group",
    "phonetic": "[ɡruːp]",
    "meaning": "组"
  },
  {
    "word": "grow",
    "phonetic": "[ɡrəʊ]",
    "meaning": "生长"
  },
  {
    "word": "growth",
    "phonetic": "[ɡrəʊθ]",
    "meaning": "成长"
  },
  {
    "word": "guarantee",
    "phonetic": "[ˌɡærənˈtiː]",
    "meaning": "保证"
  },
  {
    "word": "guard",
    "phonetic": "[ɡɑːd]",
    "meaning": "守卫"
  },
  {
    "word": "guess",
    "phonetic": "[ɡes]",
    "meaning": "猜测"
  },
  {
    "word": "guest",
    "phonetic": "[ɡest]",
    "meaning": "客人"
  },
  {
    "word": "guidance",
    "phonetic": "[ˈɡaɪdns]",
    "meaning": "指导"
  },
  {
    "word": "guide",
    "phonetic": "[ɡaɪd]",
    "meaning": "指南"
  },
  {
    "word": "guilty",
    "phonetic": "[ˈɡɪlti]",
    "meaning": "有罪的"
  },
  {
    "word": "gulf",
    "phonetic": "[ɡʌlf]",
    "meaning": "海湾"
  },
  {
    "word": "gum",
    "phonetic": "[ɡʌm]",
    "meaning": "口香糖"
  },
  {
    "word": "gun",
    "phonetic": "[ɡʌn]",
    "meaning": "枪"
  },
  {
    "word": "guy",
    "phonetic": "[ɡaɪ]",
    "meaning": "家伙"
  },
  {
    "word": "gym",
    "phonetic": "[dʒɪm]",
    "meaning": "体育馆"
  },
  {
    "word": "gymnasium",
    "phonetic": "[dʒɪmˈneɪziəm]",
    "meaning": "体育馆"
  },
  {
    "word": "habit",
    "phonetic": "[ˈhæbɪt]",
    "meaning": "习惯"
  },
  {
    "word": "habitat",
    "phonetic": "[ˈhæbɪtæt]",
    "meaning": "栖息地"
  },
  {
    "word": "hair",
    "phonetic": "[heə(r)]",
    "meaning": "头发"
  },
  {
    "word": "half",
    "phonetic": "[hɑːf]",
    "meaning": "一半"
  },
  {
    "word": "hall",
    "phonetic": "[hɔːl]",
    "meaning": "大厅"
  },
  {
    "word": "halt",
    "phonetic": "[hɔːlt]",
    "meaning": "停止"
  },
  {
    "word": "ham",
    "phonetic": "[hæm]",
    "meaning": "火腿"
  },
  {
    "word": "hamburger",
    "phonetic": "[ˈhæmbɜːɡə(r)]",
    "meaning": "汉堡"
  },
  {
    "word": "hammer",
    "phonetic": "[ˈhæmə(r)]",
    "meaning": "锤子"
  },
  {
    "word": "hand",
    "phonetic": "[hænd]",
    "meaning": "手"
  },
  {
    "word": "handful",
    "phonetic": "[ˈhændfʊl]",
    "meaning": "一把"
  },
  {
    "word": "handkerchief",
    "phonetic": "[ˈhæŋkətʃɪf]",
    "meaning": "手帕"
  },
  {
    "word": "handle",
    "phonetic": "[ˈhændl]",
    "meaning": "处理"
  },
  {
    "word": "handsome",
    "phonetic": "[ˈhænsəm]",
    "meaning": "英俊的"
  },
  {
    "word": "handwriting",
    "phonetic": "[ˈhændraɪtɪŋ]",
    "meaning": "笔迹"
  },
  {
    "word": "handy",
    "phonetic": "[ˈhændi]",
    "meaning": "方便的"
  },
  {
    "word": "hang",
    "phonetic": "[hæŋ]",
    "meaning": "悬挂"
  },
  {
    "word": "happen",
    "phonetic": "[ˈhæpən]",
    "meaning": "发生"
  },
  {
    "word": "happiness",
    "phonetic": "[ˈhæpinəs]",
    "meaning": "幸福"
  },
  {
    "word": "happy",
    "phonetic": "[ˈhæpi]",
    "meaning": "快乐的"
  },
  {
    "word": "harbor",
    "phonetic": "[ˈhɑːbə(r)]",
    "meaning": "港口"
  },
  {
    "word": "hard",
    "phonetic": "[hɑːd]",
    "meaning": "困难的"
  },
  {
    "word": "harden",
    "phonetic": "[ˈhɑːdn]",
    "meaning": "变硬"
  },
  {
    "word": "hardly",
    "phonetic": "[ˈhɑːdli]",
    "meaning": "几乎不"
  },
  {
    "word": "hardship",
    "phonetic": "[ˈhɑːdʃɪp]",
    "meaning": "困难"
  },
  {
    "word": "hardware",
    "phonetic": "[ˈhɑːdweə(r)]",
    "meaning": "硬件"
  },
  {
    "word": "harm",
    "phonetic": "[hɑːm]",
    "meaning": "伤害"
  },
  {
    "word": "harmful",
    "phonetic": "[ˈhɑːmfl]",
    "meaning": "有害的"
  },
  {
    "word": "harmless",
    "phonetic": "[ˈhɑːmləs]",
    "meaning": "无害的"
  },
  {
    "word": "harmony",
    "phonetic": "[ˈhɑːməni]",
    "meaning": "和谐"
  },
  {
    "word": "harvest",
    "phonetic": "[ˈhɑːvɪst]",
    "meaning": "收获"
  },
  {
    "word": "haste",
    "phonetic": "[heɪst]",
    "meaning": "匆忙"
  },
  {
    "word": "hasten",
    "phonetic": "[ˈheɪsn]",
    "meaning": "加速"
  },
  {
    "word": "hat",
    "phonetic": "[hæt]",
    "meaning": "帽子"
  },
  {
    "word": "hate",
    "phonetic": "[heɪt]",
    "meaning": "讨厌"
  },
  {
    "word": "hatred",
    "phonetic": "[ˈheɪtrɪd]",
    "meaning": "仇恨"
  },
  {
    "word": "have",
    "phonetic": "[hæv]",
    "meaning": "有"
  },
  {
    "word": "hawk",
    "phonetic": "[hɔːk]",
    "meaning": "鹰"
  },
  {
    "word": "hay",
    "phonetic": "[heɪ]",
    "meaning": "干草"
  },
  {
    "word": "hazard",
    "phonetic": "[ˈhæzəd]",
    "meaning": "危险"
  },
  {
    "word": "head",
    "phonetic": "[hed]",
    "meaning": "头"
  },
  {
    "word": "headache",
    "phonetic": "[ˈhedeɪk]",
    "meaning": "头痛"
  },
  {
    "word": "heading",
    "phonetic": "[ˈhedɪŋ]",
    "meaning": "标题"
  },
  {
    "word": "headline",
    "phonetic": "[ˈhedlaɪn]",
    "meaning": "头条"
  },
  {
    "word": "headmaster",
    "phonetic": "[ˌhedˈmɑːstə(r)]",
    "meaning": "校长"
  },
  {
    "word": "headquarters",
    "phonetic": "[ˌhedˈkwɔːtəz]",
    "meaning": "总部"
  },
  {
    "word": "heal",
    "phonetic": "[hiːl]",
    "meaning": "治愈"
  },
  {
    "word": "health",
    "phonetic": "[helθ]",
    "meaning": "健康"
  },
  {
    "word": "healthy",
    "phonetic": "[ˈhelθi]",
    "meaning": "健康的"
  },
  {
    "word": "heap",
    "phonetic": "[hiːp]",
    "meaning": "堆"
  },
  {
    "word": "hear",
    "phonetic": "[hɪə(r)]",
    "meaning": "听见"
  },
  {
    "word": "hearing",
    "phonetic": "[ˈhɪərɪŋ]",
    "meaning": "听力"
  },
  {
    "word": "heart",
    "phonetic": "[hɑːt]",
    "meaning": "心脏"
  },
  {
    "word": "heat",
    "phonetic": "[hiːt]",
    "meaning": "热"
  },
  {
    "word": "heating",
    "phonetic": "[ˈhiːtɪŋ]",
    "meaning": "暖气"
  },
  {
    "word": "heaven",
    "phonetic": "[ˈhevn]",
    "meaning": "天堂"
  },
  {
    "word": "heavy",
    "phonetic": "[ˈhevi]",
    "meaning": "重的"
  },
  {
    "word": "heel",
    "phonetic": "[hiːl]",
    "meaning": "脚跟"
  },
  {
    "word": "height",
    "phonetic": "[haɪt]",
    "meaning": "高度"
  },
  {
    "word": "heighten",
    "phonetic": "[ˈhaɪtn]",
    "meaning": "提高"
  },
  {
    "word": "helicopter",
    "phonetic": "[ˈhelɪkɒptə(r)]",
    "meaning": "直升机"
  },
  {
    "word": "hell",
    "phonetic": "[hel]",
    "meaning": "地狱"
  },
  {
    "word": "hello",
    "phonetic": "[həˈləʊ]",
    "meaning": "你好"
  },
  {
    "word": "helmet",
    "phonetic": "[ˈhelmɪt]",
    "meaning": "头盔"
  },
  {
    "word": "help",
    "phonetic": "[help]",
    "meaning": "帮助"
  },
  {
    "word": "helpful",
    "phonetic": "[ˈhelpfl]",
    "meaning": "有帮助的"
  },
  {
    "word": "helpless",
    "phonetic": "[ˈhelpləs]",
    "meaning": "无助的"
  },
  {
    "word": "hen",
    "phonetic": "[hen]",
    "meaning": "母鸡"
  },
  {
    "word": "hence",
    "phonetic": "[hens]",
    "meaning": "因此"
  },
  {
    "word": "her",
    "phonetic": "[hɜː(r)]",
    "meaning": "她的"
  },
  {
    "word": "herb",
    "phonetic": "[hɜːb]",
    "meaning": "香草"
  },
  {
    "word": "herd",
    "phonetic": "[hɜːd]",
    "meaning": "兽群"
  },
  {
    "word": "here",
    "phonetic": "[hɪə(r)]",
    "meaning": "这里"
  },
  {
    "word": "heritage",
    "phonetic": "[ˈherɪtɪdʒ]",
    "meaning": "遗产"
  },
  {
    "word": "hero",
    "phonetic": "[ˈhɪərəʊ]",
    "meaning": "英雄"
  },
  {
    "word": "heroic",
    "phonetic": "[həˈrəʊɪk]",
    "meaning": "英雄的"
  },
  {
    "word": "heroine",
    "phonetic": "[ˈherəʊɪn]",
    "meaning": "女英雄"
  },
  {
    "word": "hers",
    "phonetic": "[hɜːz]",
    "meaning": "她的"
  },
  {
    "word": "herself",
    "phonetic": "[hɜːˈself]",
    "meaning": "她自己"
  },
  {
    "word": "hesitate",
    "phonetic": "[ˈhezɪteɪt]",
    "meaning": "犹豫"
  },
  {
    "word": "hesitation",
    "phonetic": "[ˌhezɪˈteɪʃn]",
    "meaning": "犹豫"
  },
  {
    "word": "hide",
    "phonetic": "[haɪd]",
    "meaning": "隐藏"
  },
  {
    "word": "high",
    "phonetic": "[haɪ]",
    "meaning": "高的"
  },
  {
    "word": "highly",
    "phonetic": "[ˈhaɪli]",
    "meaning": "高度地"
  },
  {
    "word": "highlight",
    "phonetic": "[ˈhaɪlaɪt]",
    "meaning": "强调"
  },
  {
    "word": "highway",
    "phonetic": "[ˈhaɪweɪ]",
    "meaning": "公路"
  },
  {
    "word": "hill",
    "phonetic": "[hɪl]",
    "meaning": "小山"
  },
  {
    "word": "hillside",
    "phonetic": "[ˈhɪlsaɪd]",
    "meaning": "山坡"
  },
  {
    "word": "him",
    "phonetic": "[hɪm]",
    "meaning": "他"
  },
  {
    "word": "himself",
    "phonetic": "[hɪmˈself]",
    "meaning": "他自己"
  },
  {
    "word": "hind",
    "phonetic": "[haɪnd]",
    "meaning": "后面的"
  },
  {
    "word": "hindrance",
    "phonetic": "[ˈhɪndrəns]",
    "meaning": "阻碍"
  },
  {
    "word": "hint",
    "phonetic": "[hɪnt]",
    "meaning": "暗示"
  },
  {
    "word": "hip",
    "phonetic": "[hɪp]",
    "meaning": "臀部"
  },
  {
    "word": "hire",
    "phonetic": "[ˈhaɪə(r)]",
    "meaning": "雇佣"
  },
  {
    "word": "his",
    "phonetic": "[hɪz]",
    "meaning": "他的"
  },
  {
    "word": "historic",
    "phonetic": "[hɪˈstɒrɪk]",
    "meaning": "历史的"
  },
  {
    "word": "historical",
    "phonetic": "[hɪˈstɒrɪkl]",
    "meaning": "历史的"
  },
  {
    "word": "history",
    "phonetic": "[ˈhɪstri]",
    "meaning": "历史"
  },
  {
    "word": "hit",
    "phonetic": "[hɪt]",
    "meaning": "打"
  },
  {
    "word": "hobby",
    "phonetic": "[ˈhɒbi]",
    "meaning": "爱好"
  },
  {
    "word": "hold",
    "phonetic": "[həʊld]",
    "meaning": "持有"
  },
  {
    "word": "hole",
    "phonetic": "[həʊl]",
    "meaning": "洞"
  },
  {
    "word": "holiday",
    "phonetic": "[ˈhɒlədeɪ]",
    "meaning": "假期"
  },
  {
    "word": "hollow",
    "phonetic": "[ˈhɒləʊ]",
    "meaning": "空的"
  },
  {
    "word": "holy",
    "phonetic": "[ˈhəʊli]",
    "meaning": "神圣的"
  },
  {
    "word": "home",
    "phonetic": "[həʊm]",
    "meaning": "家"
  },
  {
    "word": "homeland",
    "phonetic": "[ˈhəʊmlænd]",
    "meaning": "祖国"
  },
  {
    "word": "hometown",
    "phonetic": "[ˈhəʊmtaʊn]",
    "meaning": "家乡"
  },
  {
    "word": "homework",
    "phonetic": "[ˈhəʊmwɜːk]",
    "meaning": "家庭作业"
  },
  {
    "word": "honest",
    "phonetic": "[ˈɒnɪst]",
    "meaning": "诚实的"
  },
  {
    "word": "honesty",
    "phonetic": "[ˈɒnəsti]",
    "meaning": "诚实"
  },
  {
    "word": "honey",
    "phonetic": "[ˈhʌni]",
    "meaning": "蜂蜜"
  },
  {
    "word": "honor",
    "phonetic": "[ˈɒnə(r)]",
    "meaning": "荣誉"
  },
  {
    "word": "honourable",
    "phonetic": "[ˈɒnərəbl]",
    "meaning": "荣誉的"
  },
  {
    "word": "hook",
    "phonetic": "[hʊk]",
    "meaning": "钩子"
  },
  {
    "word": "hope",
    "phonetic": "[həʊp]",
    "meaning": "希望"
  },
  {
    "word": "hopeful",
    "phonetic": "[ˈhəʊpfl]",
    "meaning": "有希望的"
  },
  {
    "word": "hopeless",
    "phonetic": "[ˈhəʊpləs]",
    "meaning": "绝望的"
  },
  {
    "word": "horizon",
    "phonetic": "[həˈraɪzn]",
    "meaning": "地平线"
  },
  {
    "word": "horizontal",
    "phonetic": "[ˌhɒrɪˈzɒntl]",
    "meaning": "水平的"
  },
  {
    "word": "horn",
    "phonetic": "[hɔːn]",
    "meaning": "角"
  },
  {
    "word": "horrible",
    "phonetic": "[ˈhɒrəbl]",
    "meaning": "可怕的"
  },
  {
    "word": "horror",
    "phonetic": "[ˈhɒrə(r)]",
    "meaning": "恐怖"
  },
  {
    "word": "horse",
    "phonetic": "[hɔːs]",
    "meaning": "马"
  },
  {
    "word": "hospital",
    "phonetic": "[ˈhɒspɪtl]",
    "meaning": "医院"
  },
  {
    "word": "host",
    "phonetic": "[həʊst]",
    "meaning": "主人"
  },
  {
    "word": "hostess",
    "phonetic": "[ˈhəʊstəs]",
    "meaning": "女主人"
  },
  {
    "word": "hostile",
    "phonetic": "[ˈhɒstaɪl]",
    "meaning": "敌对的"
  },
  {
    "word": "hotel",
    "phonetic": "[həʊˈtel]",
    "meaning": "酒店"
  },
  {
    "word": "hour",
    "phonetic": "[ˈaʊə(r)]",
    "meaning": "小时"
  },
  {
    "word": "house",
    "phonetic": "[haʊs]",
    "meaning": "房子"
  },
  {
    "word": "household",
    "phonetic": "[ˈhaʊshəʊld]",
    "meaning": "家庭"
  },
  {
    "word": "housewife",
    "phonetic": "[ˈhaʊswaɪf]",
    "meaning": "家庭主妇"
  },
  {
    "word": "housing",
    "phonetic": "[ˈhaʊzɪŋ]",
    "meaning": "住房"
  },
  {
    "word": "how",
    "phonetic": "[haʊ]",
    "meaning": "如何"
  },
  {
    "word": "however",
    "phonetic": "[haʊˈevə(r)]",
    "meaning": "然而"
  },
  {
    "word": "howl",
    "phonetic": "[haʊl]",
    "meaning": "嚎叫"
  },
  {
    "word": "hug",
    "phonetic": "[hʌɡ]",
    "meaning": "拥抱"
  },
  {
    "word": "human",
    "phonetic": "[ˈhjuːmən]",
    "meaning": "人类"
  },
  {
    "word": "humanity",
    "phonetic": "[hjuːˈmænəti]",
    "meaning": "人性"
  },
  {
    "word": "humanitarian",
    "phonetic": "[hjuːˌmænɪˈteəriən]",
    "meaning": "人道主义的"
  },
  {
    "word": "humble",
    "phonetic": "[ˈhʌmbl]",
    "meaning": "谦虚的"
  },
  {
    "word": "humid",
    "phonetic": "[ˈhjuːmɪd]",
    "meaning": "潮湿的"
  },
  {
    "word": "humidity",
    "phonetic": "[hjuːˈmɪdəti]",
    "meaning": "湿度"
  },
  {
    "word": "humor",
    "phonetic": "[ˈhjuːmə(r)]",
    "meaning": "幽默"
  },
  {
    "word": "humorous",
    "phonetic": "[ˈhjuːmərəs]",
    "meaning": "幽默的"
  },
  {
    "word": "hundred",
    "phonetic": "[ˈhʌndrəd]",
    "meaning": "百"
  },
  {
    "word": "hunger",
    "phonetic": "[ˈhʌŋɡə(r)]",
    "meaning": "饥饿"
  },
  {
    "word": "hungry",
    "phonetic": "[ˈhʌŋɡri]",
    "meaning": "饥饿的"
  },
  {
    "word": "hunt",
    "phonetic": "[hʌnt]",
    "meaning": "狩猎"
  },
  {
    "word": "hunter",
    "phonetic": "[ˈhʌntə(r)]",
    "meaning": "猎人"
  },
  {
    "word": "hurricane",
    "phonetic": "[ˈhʌrɪkən]",
    "meaning": "飓风"
  },
  {
    "word": "hurry",
    "phonetic": "[ˈhʌri]",
    "meaning": "匆忙"
  },
  {
    "word": "hurt",
    "phonetic": "[hɜːt]",
    "meaning": "伤害"
  },
  {
    "word": "husband",
    "phonetic": "[ˈhʌzbənd]",
    "meaning": "丈夫"
  },
  {
    "word": "hut",
    "phonetic": "[hʌt]",
    "meaning": "小屋"
  },
  {
    "word": "hydrogen",
    "phonetic": "[ˈhaɪdrədʒən]",
    "meaning": "氢"
  },
  {
    "word": "hypothesis",
    "phonetic": "[haɪˈpɒθəsɪs]",
    "meaning": "假设"
  },
  {
    "word": "hypothetical",
    "phonetic": "[ˌhaɪpəˈθetɪkl]",
    "meaning": "假设的"
  },
  {
    "word": "ice",
    "phonetic": "[aɪs]",
    "meaning": "冰"
  },
  {
    "word": "iceberg",
    "phonetic": "[ˈaɪsbɜːɡ]",
    "meaning": "冰山"
  },
  {
    "word": "icebox",
    "phonetic": "[ˈaɪsbɒks]",
    "meaning": "冰箱"
  },
  {
    "word": "idea",
    "phonetic": "[aɪˈdiːə]",
    "meaning": "想法"
  },
  {
    "word": "ideal",
    "phonetic": "[aɪˈdiːəl]",
    "meaning": "理想的"
  },
  {
    "word": "identical",
    "phonetic": "[aɪˈdentɪkl]",
    "meaning": "相同的"
  },
  {
    "word": "identify",
    "phonetic": "[aɪˈdentɪfaɪ]",
    "meaning": "识别"
  },
  {
    "word": "identity",
    "phonetic": "[aɪˈdentəti]",
    "meaning": "身份"
  },
  {
    "word": "ideology",
    "phonetic": "[ˌaɪdiˈɒlədʒi]",
    "meaning": "意识形态"
  },
  {
    "word": "idiom",
    "phonetic": "[ˈɪdiəm]",
    "meaning": "习语"
  },
  {
    "word": "idiot",
    "phonetic": "[ˈɪdiət]",
    "meaning": "白痴"
  },
  {
    "word": "idle",
    "phonetic": "[ˈaɪdl]",
    "meaning": "空闲的"
  },
  {
    "word": "if",
    "phonetic": "[ɪf]",
    "meaning": "如果"
  },
  {
    "word": "ignorance",
    "phonetic": "[ˈɪɡnərəns]",
    "meaning": "无知"
  },
  {
    "word": "ignorant",
    "phonetic": "[ˈɪɡnərənt]",
    "meaning": "无知的"
  },
  {
    "word": "ignore",
    "phonetic": "[ɪɡˈnɔː(r)]",
    "meaning": "忽略"
  },
  {
    "word": "ill",
    "phonetic": "[ɪl]",
    "meaning": "生病的"
  },
  {
    "word": "illegal",
    "phonetic": "[ɪˈliːɡl]",
    "meaning": "非法的"
  },
  {
    "word": "illness",
    "phonetic": "[ˈɪlnəs]",
    "meaning": "疾病"
  },
  {
    "word": "illustrate",
    "phonetic": "[ˈɪləstreɪt]",
    "meaning": "说明"
  },
  {
    "word": "illustration",
    "phonetic": "[ˌɪləˈstreɪʃn]",
    "meaning": "插图"
  },
  {
    "word": "image",
    "phonetic": "[ˈɪmɪdʒ]",
    "meaning": "图像"
  },
  {
    "word": "imaginary",
    "phonetic": "[ɪˈmædʒɪnəri]",
    "meaning": "想象的"
  },
  {
    "word": "imagination",
    "phonetic": "[ɪˌmædʒɪˈneɪʃn]",
    "meaning": "想象"
  },
  {
    "word": "imagine",
    "phonetic": "[ɪˈmædʒɪn]",
    "meaning": "想象"
  },
  {
    "word": "imitate",
    "phonetic": "[ˈɪmɪteɪt]",
    "meaning": "模仿"
  },
  {
    "word": "imitation",
    "phonetic": "[ˌɪmɪˈteɪʃn]",
    "meaning": "模仿"
  },
  {
    "word": "immediate",
    "phonetic": "[ɪˈmiːdiət]",
    "meaning": "立即的"
  },
  {
    "word": "immediately",
    "phonetic": "[ɪˈmiːdiətli]",
    "meaning": "立即"
  },
  {
    "word": "immense",
    "phonetic": "[ɪˈmens]",
    "meaning": "巨大的"
  },
  {
    "word": "immigrant",
    "phonetic": "[ˈɪmɪɡrənt]",
    "meaning": "移民"
  },
  {
    "word": "immigration",
    "phonetic": "[ˌɪmɪˈɡreɪʃn]",
    "meaning": "移民"
  },
  {
    "word": "impact",
    "phonetic": "[ˈɪmpækt]",
    "meaning": "影响"
  },
  {
    "word": "impatient",
    "phonetic": "[ɪmˈpeɪʃnt]",
    "meaning": "不耐烦的"
  },
  {
    "word": "imperial",
    "phonetic": "[ɪmˈpɪəriəl]",
    "meaning": "帝国的"
  },
  {
    "word": "implement",
    "phonetic": "[ˈɪmplɪment]",
    "meaning": "实施"
  },
  {
    "word": "implication",
    "phonetic": "[ˌɪmplɪˈkeɪʃn]",
    "meaning": "含义"
  },
  {
    "word": "implicit",
    "phonetic": "[ɪmˈplɪsɪt]",
    "meaning": "隐含的"
  },
  {
    "word": "imply",
    "phonetic": "[ɪmˈplaɪ]",
    "meaning": "暗示"
  },
  {
    "word": "import",
    "phonetic": "[ˈɪmpɔːt]",
    "meaning": "进口"
  },
  {
    "word": "importance",
    "phonetic": "[ɪmˈpɔːtns]",
    "meaning": "重要性"
  },
  {
    "word": "important",
    "phonetic": "[ɪmˈpɔːtnt]",
    "meaning": "重要的"
  },
  {
    "word": "impose",
    "phonetic": "[ɪmˈpəʊz]",
    "meaning": "强加"
  },
  {
    "word": "impossible",
    "phonetic": "[ɪmˈpɒsəbl]",
    "meaning": "不可能的"
  },
  {
    "word": "impress",
    "phonetic": "[ɪmˈpres]",
    "meaning": "给...留下印象"
  },
  {
    "word": "impression",
    "phonetic": "[ɪmˈpreʃn]",
    "meaning": "印象"
  },
  {
    "word": "impressive",
    "phonetic": "[ɪmˈpresɪv]",
    "meaning": "令人印象深刻的"
  },
  {
    "word": "improve",
    "phonetic": "[ɪmˈpruːv]",
    "meaning": "提高"
  },
  {
    "word": "improvement",
    "phonetic": "[ɪmˈpruːvmənt]",
    "meaning": "改进"
  },
  {
    "word": "in",
    "phonetic": "[ɪn]",
    "meaning": "在...里"
  },
  {
    "word": "inch",
    "phonetic": "[ɪntʃ]",
    "meaning": "英寸"
  },
  {
    "word": "incident",
    "phonetic": "[ˈɪnsɪdənt]",
    "meaning": "事件"
  },
  {
    "word": "incidentally",
    "phonetic": "[ˌɪnsɪˈdentli]",
    "meaning": "顺便说"
  },
  {
    "word": "incline",
    "phonetic": "[ɪnˈklaɪn]",
    "meaning": "倾斜"
  },
  {
    "word": "include",
    "phonetic": "[ɪnˈkluːd]",
    "meaning": "包括"
  },
  {
    "word": "including",
    "phonetic": "[ɪnˈkluːdɪŋ]",
    "meaning": "包括"
  },
  {
    "word": "inclusive",
    "phonetic": "[ɪnˈkluːsɪv]",
    "meaning": "包容的"
  },
  {
    "word": "income",
    "phonetic": "[ˈɪnkʌm]",
    "meaning": "收入"
  },
  {
    "word": "increase",
    "phonetic": "[ɪnˈkriːs]",
    "meaning": "增加"
  },
  {
    "word": "increasingly",
    "phonetic": "[ɪnˈkriːsɪŋli]",
    "meaning": "越来越"
  },
  {
    "word": "incredible",
    "phonetic": "[ɪnˈkredəbl]",
    "meaning": "难以置信的"
  },
  {
    "word": "incredibly",
    "phonetic": "[ɪnˈkredəbli]",
    "meaning": "难以置信地"
  },
  {
    "word": "indeed",
    "phonetic": "[ɪnˈdiːd]",
    "meaning": "确实"
  },
  {
    "word": "independence",
    "phonetic": "[ˌɪndɪˈpendəns]",
    "meaning": "独立"
  },
  {
    "word": "independent",
    "phonetic": "[ˌɪndɪˈpendənt]",
    "meaning": "独立的"
  },
  {
    "word": "index",
    "phonetic": "[ˈɪndeks]",
    "meaning": "索引"
  },
  {
    "word": "India",
    "phonetic": "[ˈɪndiə]",
    "meaning": "印度"
  },
  {
    "word": "Indian",
    "phonetic": "[ˈɪndiən]",
    "meaning": "印度的"
  },
  {
    "word": "indicate",
    "phonetic": "[ˈɪndɪkeɪt]",
    "meaning": "表明"
  },
  {
    "word": "indication",
    "phonetic": "[ˌɪndɪˈkeɪʃn]",
    "meaning": "迹象"
  },
  {
    "word": "indicator",
    "phonetic": "[ˈɪndɪkeɪtə(r)]",
    "meaning": "指示器"
  },
  {
    "word": "indirect",
    "phonetic": "[ˌɪndəˈrekt]",
    "meaning": "间接的"
  },
  {
    "word": "individually",
    "phonetic": "[ˌɪndɪˈvɪdʒuəli]",
    "meaning": "个别地"
  },
  {
    "word": "individual",
    "phonetic": "[ˌɪndɪˈvɪdʒuəl]",
    "meaning": "个人"
  },
  {
    "word": "indoor",
    "phonetic": "[ˈɪndɔː(r)]",
    "meaning": "室内的"
  },
  {
    "word": "induce",
    "phonetic": "[ɪnˈdjuːs]",
    "meaning": "引起"
  },
  {
    "word": "industrial",
    "phonetic": "[ɪnˈdʌstriəl]",
    "meaning": "工业的"
  },
  {
    "word": "industry",
    "phonetic": "[ˈɪndəstri]",
    "meaning": "工业"
  },
  {
    "word": "inefficient",
    "phonetic": "[ˌɪnɪˈfɪʃnt]",
    "meaning": "低效的"
  },
  {
    "word": "inevitable",
    "phonetic": "[ɪnˈevɪtəbl]",
    "meaning": "不可避免的"
  },
  {
    "word": "inevitably",
    "phonetic": "[ɪnˈevɪtəbli]",
    "meaning": "必然地"
  },
  {
    "word": "inexperienced",
    "phonetic": "[ˌɪnɪkˈspɪəriənst]",
    "meaning": "缺乏经验的"
  },
  {
    "word": "infant",
    "phonetic": "[ˈɪnfənt]",
    "meaning": "婴儿"
  },
  {
    "word": "infect",
    "phonetic": "[ɪnˈfekt]",
    "meaning": "感染"
  },
  {
    "word": "infection",
    "phonetic": "[ɪnˈfekʃn]",
    "meaning": "感染"
  },
  {
    "word": "infectious",
    "phonetic": "[ɪnˈfekʃəs]",
    "meaning": "传染的"
  },
  {
    "word": "infer",
    "phonetic": "[ɪnˈfɜː(r)]",
    "meaning": "推断"
  },
  {
    "word": "inferior",
    "phonetic": "[ɪnˈfɪəriə(r)]",
    "meaning": "劣等的"
  },
  {
    "word": "infinite",
    "phonetic": "[ˈɪnfɪnət]",
    "meaning": "无限的"
  },
  {
    "word": "inflation",
    "phonetic": "[ɪnˈfleɪʃn]",
    "meaning": "通货膨胀"
  },
  {
    "word": "influence",
    "phonetic": "[ˈɪnfluəns]",
    "meaning": "影响"
  },
  {
    "word": "influential",
    "phonetic": "[ˌɪnfluˈenʃl]",
    "meaning": "有影响力的"
  },
  {
    "word": "inform",
    "phonetic": "[ɪnˈfɔːm]",
    "meaning": "通知"
  },
  {
    "word": "information",
    "phonetic": "[ˌɪnfəˈmeɪʃn]",
    "meaning": "信息"
  },
  {
    "word": "informative",
    "phonetic": "[ɪnˈfɔːmətɪv]",
    "meaning": "信息丰富的"
  },
  {
    "word": "inhabitant",
    "phonetic": "[ɪnˈhæbɪtənt]",
    "meaning": "居民"
  },
  {
    "word": "inherit",
    "phonetic": "[ɪnˈherɪt]",
    "meaning": "继承"
  },
  {
    "word": "initial",
    "phonetic": "[ɪˈnɪʃl]",
    "meaning": "初始的"
  },
  {
    "word": "initially",
    "phonetic": "[ɪˈnɪʃəli]",
    "meaning": "最初"
  },
  {
    "word": "initiative",
    "phonetic": "[ɪˈnɪʃətɪv]",
    "meaning": "主动性"
  },
  {
    "word": "inject",
    "phonetic": "[ɪnˈdʒekt]",
    "meaning": "注射"
  },
  {
    "word": "injury",
    "phonetic": "[ˈɪndʒəri]",
    "meaning": "伤害"
  },
  {
    "word": "insect",
    "phonetic": "[ˈɪnsekt]",
    "meaning": "昆虫"
  },
  {
    "word": "insert",
    "phonetic": "[ɪnˈsɜːt]",
    "meaning": "插入"
  },
  {
    "word": "inside",
    "phonetic": "[ˌɪnˈsaɪd]",
    "meaning": "里面"
  },
  {
    "word": "insight",
    "phonetic": "[ˈɪnsaɪt]",
    "meaning": "洞察力"
  },
  {
    "word": "insist",
    "phonetic": "[ɪnˈsɪst]",
    "meaning": "坚持"
  },
  {
    "word": "instance",
    "phonetic": "[ˈɪnstəns]",
    "meaning": "例子"
  },
  {
    "word": "instant",
    "phonetic": "[ˈɪnstənt]",
    "meaning": "立即的"
  },
  {
    "word": "instead",
    "phonetic": "[ɪnˈsted]",
    "meaning": "代替"
  },
  {
    "word": "instinct",
    "phonetic": "[ˈɪnstɪŋkt]",
    "meaning": "本能"
  },
  {
    "word": "institute",
    "phonetic": "[ˈɪnstɪtjuːt]",
    "meaning": "学院"
  },
  {
    "word": "institution",
    "phonetic": "[ˌɪnstɪˈtjuːʃn]",
    "meaning": "机构"
  },
  {
    "word": "instruct",
    "phonetic": "[ɪnˈstrʌkt]",
    "meaning": "指导"
  },
  {
    "word": "instruction",
    "phonetic": "[ɪnˈstrʌkʃn]",
    "meaning": "指示"
  },
  {
    "word": "instrument",
    "phonetic": "[ˈɪnstrəmənt]",
    "meaning": "乐器"
  },
  {
    "word": "insurance",
    "phonetic": "[ɪnˈʃʊərəns]",
    "meaning": "保险"
  },
  {
    "word": "insure",
    "phonetic": "[ɪnˈʃʊə(r)]",
    "meaning": "确保"
  },
  {
    "word": "intellectual",
    "phonetic": "[ˌɪntəˈlektʃuəl]",
    "meaning": "智力的"
  },
  {
    "word": "intelligence",
    "phonetic": "[ɪnˈtelɪdʒəns]",
    "meaning": "智力"
  },
  {
    "word": "intelligent",
    "phonetic": "[ɪnˈtelɪdʒənt]",
    "meaning": "聪明的"
  },
  {
    "word": "intend",
    "phonetic": "[ɪnˈtend]",
    "meaning": "打算"
  },
  {
    "word": "intense",
    "phonetic": "[ɪnˈtens]",
    "meaning": "强烈的"
  },
  {
    "word": "intensity",
    "phonetic": "[ɪnˈtensəti]",
    "meaning": "强度"
  },
  {
    "word": "intensive",
    "phonetic": "[ɪnˈtensɪv]",
    "meaning": "密集的"
  },
  {
    "word": "intention",
    "phonetic": "[ɪnˈtenʃn]",
    "meaning": "意图"
  },
  {
    "word": "interact",
    "phonetic": "[ˌɪntərˈækt]",
    "meaning": "互动"
  },
  {
    "word": "interaction",
    "phonetic": "[ˌɪntərˈækʃn]",
    "meaning": "相互作用"
  },
  {
    "word": "interest",
    "phonetic": "[ˈɪntrəst]",
    "meaning": "兴趣"
  },
  {
    "word": "interesting",
    "phonetic": "[ˈɪntrəstɪŋ]",
    "meaning": "有趣的"
  },
  {
    "word": "interfere",
    "phonetic": "[ˌɪntəˈfɪə(r)]",
    "meaning": "干涉"
  },
  {
    "word": "interference",
    "phonetic": "[ˌɪntəˈfɪərəns]",
    "meaning": "干扰"
  },
  {
    "word": "interior",
    "phonetic": "[ɪnˈtɪəriə(r)]",
    "meaning": "内部"
  },
  {
    "word": "intermediate",
    "phonetic": "[ˌɪntəˈmiːdiət]",
    "meaning": "中级的"
  },
  {
    "word": "internal",
    "phonetic": "[ɪnˈtɜːnl]",
    "meaning": "内部的"
  },
  {
    "word": "international",
    "phonetic": "[ˌɪntəˈnæʃnəl]",
    "meaning": "国际的"
  },
  {
    "word": "internet",
    "phonetic": "[ˈɪntənet]",
    "meaning": "互联网"
  },
  {
    "word": "interpret",
    "phonetic": "[ɪnˈtɜːprɪt]",
    "meaning": "解释"
  },
  {
    "word": "interpretation",
    "phonetic": "[ɪnˌtɜːprɪˈteɪʃn]",
    "meaning": "解释"
  },
  {
    "word": "interrupt",
    "phonetic": "[ˌɪntəˈrʌpt]",
    "meaning": "打断"
  },
  {
    "word": "interval",
    "phonetic": "[ˈɪntəvl]",
    "meaning": "间隔"
  },
  {
    "word": "interview",
    "phonetic": "[ˈɪntəvjuː]",
    "meaning": "面试"
  },
  {
    "word": "into",
    "phonetic": "[ˈɪntuː]",
    "meaning": "进入"
  },
  {
    "word": "introduce",
    "phonetic": "[ˌɪntrəˈdjuːs]",
    "meaning": "介绍"
  },
  {
    "word": "introduction",
    "phonetic": "[ˌɪntrəˈdʌkʃn]",
    "meaning": "介绍"
  },
  {
    "word": "invade",
    "phonetic": "[ɪnˈveɪd]",
    "meaning": "入侵"
  },
  {
    "word": "invalid",
    "phonetic": "[ɪnˈvælɪd]",
    "meaning": "无效的"
  },
  {
    "word": "invent",
    "phonetic": "[ɪnˈvent]",
    "meaning": "发明"
  },
  {
    "word": "invention",
    "phonetic": "[ɪnˈvenʃn]",
    "meaning": "发明"
  },
  {
    "word": "invest",
    "phonetic": "[ɪnˈvest]",
    "meaning": "投资"
  },
  {
    "word": "investigate",
    "phonetic": "[ɪnˈvestɪɡeɪt]",
    "meaning": "调查"
  },
  {
    "word": "investigation",
    "phonetic": "[ɪnˌvestɪˈɡeɪʃn]",
    "meaning": "调查"
  },
  {
    "word": "investment",
    "phonetic": "[ɪnˈvestmənt]",
    "meaning": "投资"
  },
  {
    "word": "invisible",
    "phonetic": "[ɪnˈvɪzəbl]",
    "meaning": "看不见的"
  },
  {
    "word": "invitation",
    "phonetic": "[ˌɪnvɪˈteɪʃn]",
    "meaning": "邀请"
  },
  {
    "word": "invite",
    "phonetic": "[ɪnˈvaɪt]",
    "meaning": "邀请"
  },
  {
    "word": "involve",
    "phonetic": "[ɪnˈvɒlv]",
    "meaning": "涉及"
  },
  {
    "word": "involved",
    "phonetic": "[ɪnˈvɒlvd]",
    "meaning": "卷入的"
  },
  {
    "word": "involvement",
    "phonetic": "[ɪnˈvɒlvmənt]",
    "meaning": "参与"
  },
  {
    "word": "iron",
    "phonetic": "[ˈaɪən]",
    "meaning": "铁"
  },
  {
    "word": "irrigate",
    "phonetic": "[ˈɪrɪɡeɪt]",
    "meaning": "灌溉"
  },
  {
    "word": "irrigation",
    "phonetic": "[ˌɪrɪˈɡeɪʃn]",
    "meaning": "灌溉"
  },
  {
    "word": "Islam",
    "phonetic": "[ˈɪslɑːm]",
    "meaning": "伊斯兰教"
  },
  {
    "word": "island",
    "phonetic": "[ˈaɪlənd]",
    "meaning": "岛屿"
  },
  {
    "word": "isolate",
    "phonetic": "[ˈaɪsəleɪt]",
    "meaning": "隔离"
  },
  {
    "word": "isolation",
    "phonetic": "[ˌaɪsəˈleɪʃn]",
    "meaning": "隔离"
  },
  {
    "word": "issue",
    "phonetic": "[ˈɪʃuː]",
    "meaning": "问题"
  },
  {
    "word": "it",
    "phonetic": "[ɪt]",
    "meaning": "它"
  },
  {
    "word": "Italian",
    "phonetic": "[ɪˈtæliən]",
    "meaning": "意大利的"
  },
  {
    "word": "Italy",
    "phonetic": "[ˈɪtəli]",
    "meaning": "意大利"
  },
  {
    "word": "item",
    "phonetic": "[ˈaɪtəm]",
    "meaning": "项目"
  },
  {
    "word": "its",
    "phonetic": "[ɪts]",
    "meaning": "它的"
  },
  {
    "word": "itself",
    "phonetic": "[ɪtˈself]",
    "meaning": "它自己"
  },
  {
    "word": "jacket",
    "phonetic": "[ˈdʒækɪt]",
    "meaning": "夹克"
  },
  {
    "word": "jail",
    "phonetic": "[dʒeɪl]",
    "meaning": "监狱"
  },
  {
    "word": "jam",
    "phonetic": "[dʒæm]",
    "meaning": "果酱"
  },
  {
    "word": "January",
    "phonetic": "[ˈdʒænjuəri]",
    "meaning": "一月"
  },
  {
    "word": "Japan",
    "phonetic": "[dʒəˈpæn]",
    "meaning": "日本"
  },
  {
    "word": "Japanese",
    "phonetic": "[ˌdʒæpəˈniːz]",
    "meaning": "日本的"
  },
  {
    "word": "jar",
    "phonetic": "[dʒɑː(r)]",
    "meaning": "罐子"
  },
  {
    "word": "jaw",
    "phonetic": "[dʒɔː]",
    "meaning": "下巴"
  },
  {
    "word": "jazz",
    "phonetic": "[dʒæz]",
    "meaning": "爵士乐"
  },
  {
    "word": "jeans",
    "phonetic": "[dʒiːnz]",
    "meaning": "牛仔裤"
  },
  {
    "word": "jeep",
    "phonetic": "[dʒiːp]",
    "meaning": "吉普车"
  },
  {
    "word": "jet",
    "phonetic": "[dʒet]",
    "meaning": "喷气式飞机"
  },
  {
    "word": "Jew",
    "phonetic": "[dʒuː]",
    "meaning": "犹太人"
  },
  {
    "word": "jewel",
    "phonetic": "[ˈdʒuːəl]",
    "meaning": "珠宝"
  },
  {
    "word": "jewelry",
    "phonetic": "[ˈdʒuːəlri]",
    "meaning": "珠宝"
  },
  {
    "word": "Jewish",
    "phonetic": "[ˈdʒuːɪʃ]",
    "meaning": "犹太的"
  },
  {
    "word": "job",
    "phonetic": "[dʒɒb]",
    "meaning": "工作"
  },
  {
    "word": "join",
    "phonetic": "[dʒɔɪn]",
    "meaning": "加入"
  },
  {
    "word": "joint",
    "phonetic": "[dʒɔɪnt]",
    "meaning": "关节"
  },
  {
    "word": "joke",
    "phonetic": "[dʒəʊk]",
    "meaning": "笑话"
  },
  {
    "word": "journal",
    "phonetic": "[ˈdʒɜːnl]",
    "meaning": "日记"
  },
  {
    "word": "journey",
    "phonetic": "[ˈdʒɜːni]",
    "meaning": "旅行"
  },
  {
    "word": "joy",
    "phonetic": "[dʒɔɪ]",
    "meaning": "喜悦"
  },
  {
    "word": "joyful",
    "phonetic": "[ˈdʒɔɪfl]",
    "meaning": "快乐的"
  },
  {
    "word": "judge",
    "phonetic": "[dʒʌdʒ]",
    "meaning": "判断"
  },
  {
    "word": "judgement",
    "phonetic": "[ˈdʒʌdʒmənt]",
    "meaning": "判断"
  },
  {
    "word": "juice",
    "phonetic": "[dʒuːs]",
    "meaning": "果汁"
  },
  {
    "word": "July",
    "phonetic": "[dʒuˈlaɪ]",
    "meaning": "七月"
  },
  {
    "word": "jump",
    "phonetic": "[dʒʌmp]",
    "meaning": "跳跃"
  },
  {
    "word": "June",
    "phonetic": "[dʒuːn]",
    "meaning": "六月"
  },
  {
    "word": "jungle",
    "phonetic": "[ˈdʒʌŋɡl]",
    "meaning": "丛林"
  },
  {
    "word": "junior",
    "phonetic": "[ˈdʒuːniə(r)]",
    "meaning": "初级的"
  },
  {
    "word": "jury",
    "phonetic": "[ˈdʒʊəri]",
    "meaning": "陪审团"
  },
  {
    "word": "just",
    "phonetic": "[dʒʌst]",
    "meaning": "正好"
  },
  {
    "word": "justice",
    "phonetic": "[ˈdʒʌstɪs]",
    "meaning": "正义"
  },
  {
    "word": "justify",
    "phonetic": "[ˈdʒʌstɪfaɪ]",
    "meaning": "证明...正当"
  },
  {
    "word": "juvenile",
    "phonetic": "[ˈdʒuːvənaɪl]",
    "meaning": "青少年的"
  },
  {
    "word": "kangaroo",
    "phonetic": "[ˌkæŋɡəˈruː]",
    "meaning": "袋鼠"
  },
  {
    "word": "keen",
    "phonetic": "[kiːn]",
    "meaning": "敏锐的"
  },
  {
    "word": "keep",
    "phonetic": "[kiːp]",
    "meaning": "保持"
  },
  {
    "word": "keeper",
    "phonetic": "[ˈkiːpə(r)]",
    "meaning": "守护者"
  },
  {
    "word": "kettle",
    "phonetic": "[ˈketl]",
    "meaning": "水壶"
  },
  {
    "word": "key",
    "phonetic": "[kiː]",
    "meaning": "钥匙"
  },
  {
    "word": "keyboard",
    "phonetic": "[ˈkiːbɔːd]",
    "meaning": "键盘"
  },
  {
    "word": "kick",
    "phonetic": "[kɪk]",
    "meaning": "踢"
  },
  {
    "word": "kid",
    "phonetic": "[kɪd]",
    "meaning": "孩子"
  },
  {
    "word": "kidnap",
    "phonetic": "[ˈkɪdnæp]",
    "meaning": "绑架"
  },
  {
    "word": "kidney",
    "phonetic": "[ˈkɪdni]",
    "meaning": "肾脏"
  },
  {
    "word": "kill",
    "phonetic": "[kɪl]",
    "meaning": "杀死"
  },
  {
    "word": "killer",
    "phonetic": "[ˈkɪlə(r)]",
    "meaning": "杀手"
  },
  {
    "word": "kilo",
    "phonetic": "[ˈkiːləʊ]",
    "meaning": "千克"
  },
  {
    "word": "kilogram",
    "phonetic": "[ˈkɪləɡræm]",
    "meaning": "千克"
  },
  {
    "word": "kilometer",
    "phonetic": "[kɪˈlɒmɪtə(r)]",
    "meaning": "千米"
  },
  {
    "word": "kind",
    "phonetic": "[kaɪnd]",
    "meaning": "种类"
  },
  {
    "word": "kindergarten",
    "phonetic": "[ˈkɪndəɡɑːtn]",
    "meaning": "幼儿园"
  },
  {
    "word": "kindness",
    "phonetic": "[ˈkaɪndnəs]",
    "meaning": "善良"
  },
  {
    "word": "king",
    "phonetic": "[kɪŋ]",
    "meaning": "国王"
  },
  {
    "word": "kingdom",
    "phonetic": "[ˈkɪŋdəm]",
    "meaning": "王国"
  },
  {
    "word": "kiss",
    "phonetic": "[kɪs]",
    "meaning": "吻"
  },
  {
    "word": "kit",
    "phonetic": "[kɪt]",
    "meaning": "工具包"
  },
  {
    "word": "kitchen",
    "phonetic": "[ˈkɪtʃɪn]",
    "meaning": "厨房"
  },
  {
    "word": "kite",
    "phonetic": "[kaɪt]",
    "meaning": "风筝"
  },
  {
    "word": "kitten",
    "phonetic": "[ˈkɪtn]",
    "meaning": "小猫"
  },
  {
    "word": "kneel",
    "phonetic": "[niːl]",
    "meaning": "跪下"
  },
  {
    "word": "knee",
    "phonetic": "[niː]",
    "meaning": "膝盖"
  },
  {
    "word": "knife",
    "phonetic": "[naɪf]",
    "meaning": "刀"
  },
  {
    "word": "knock",
    "phonetic": "[nɒk]",
    "meaning": "敲"
  },
  {
    "word": "know",
    "phonetic": "[nəʊ]",
    "meaning": "知道"
  },
  {
    "word": "knowledge",
    "phonetic": "[ˈnɒlɪdʒ]",
    "meaning": "知识"
  },
  {
    "word": "known",
    "phonetic": "[nəʊn]",
    "meaning": "已知的"
  },
  {
    "word": "knuckle",
    "phonetic": "[ˈnʌkl]",
    "meaning": "指关节"
  },
  {
    "word": "koala",
    "phonetic": "[kəʊˈɑːlə]",
    "meaning": "考拉"
  },
  {
    "word": "lab",
    "phonetic": "[læb]",
    "meaning": "实验室"
  },
  {
    "word": "label",
    "phonetic": "[ˈleɪbl]",
    "meaning": "标签"
  },
  {
    "word": "laboratory",
    "phonetic": "[ləˈbɒrətri]",
    "meaning": "实验室"
  },
  {
    "word": "labour",
    "phonetic": "[ˈleɪbə(r)]",
    "meaning": "劳动"
  },
  {
    "word": "lack",
    "phonetic": "[læk]",
    "meaning": "缺乏"
  },
  {
    "word": "ladder",
    "phonetic": "[ˈlædə(r)]",
    "meaning": "梯子"
  },
  {
    "word": "lady",
    "phonetic": "[ˈleɪdi]",
    "meaning": "女士"
  },
  {
    "word": "lake",
    "phonetic": "[leɪk]",
    "meaning": "湖泊"
  },
  {
    "word": "lamb",
    "phonetic": "[læm]",
    "meaning": "羔羊"
  },
  {
    "word": "lame",
    "phonetic": "[leɪm]",
    "meaning": "瘸的"
  },
  {
    "word": "lamp",
    "phonetic": "[læmp]",
    "meaning": "灯"
  },
  {
    "word": "land",
    "phonetic": "[lænd]",
    "meaning": "陆地"
  },
  {
    "word": "landing",
    "phonetic": "[ˈlændɪŋ]",
    "meaning": "着陆"
  },
  {
    "word": "landlord",
    "phonetic": "[ˈlændlɔːd]",
    "meaning": "房东"
  },
  {
    "word": "landscape",
    "phonetic": "[ˈlændskeɪp]",
    "meaning": "风景"
  },
  {
    "word": "lane",
    "phonetic": "[leɪn]",
    "meaning": "小巷"
  },
  {
    "word": "language",
    "phonetic": "[ˈlæŋɡwɪdʒ]",
    "meaning": "语言"
  },
  {
    "word": "lap",
    "phonetic": "[læp]",
    "meaning": "大腿"
  },
  {
    "word": "large",
    "phonetic": "[lɑːdʒ]",
    "meaning": "大的"
  },
  {
    "word": "largely",
    "phonetic": "[ˈlɑːdʒli]",
    "meaning": "主要地"
  },
  {
    "word": "laser",
    "phonetic": "[ˈleɪzə(r)]",
    "meaning": "激光"
  },
  {
    "word": "last",
    "phonetic": "[lɑːst]",
    "meaning": "最后的"
  },
  {
    "word": "late",
    "phonetic": "[leɪt]",
    "meaning": "迟到的"
  },
  {
    "word": "lately",
    "phonetic": "[ˈleɪtli]",
    "meaning": "最近"
  },
  {
    "word": "later",
    "phonetic": "[ˈleɪtə(r)]",
    "meaning": "后来"
  },
  {
    "word": "latter",
    "phonetic": "[ˈlætə(r)]",
    "meaning": "后者"
  },
  {
    "word": "laugh",
    "phonetic": "[lɑːf]",
    "meaning": "笑"
  },
  {
    "word": "laughter",
    "phonetic": "[ˈlɑːftə(r)]",
    "meaning": "笑声"
  },
  {
    "word": "launch",
    "phonetic": "[lɔːntʃ]",
    "meaning": "发射"
  },
  {
    "word": "laundry",
    "phonetic": "[ˈlɔːndri]",
    "meaning": "洗衣店"
  },
  {
    "word": "lavatory",
    "phonetic": "[ˈlævətri]",
    "meaning": "厕所"
  },
  {
    "word": "law",
    "phonetic": "[lɔː]",
    "meaning": "法律"
  },
  {
    "word": "lawn",
    "phonetic": "[lɔːn]",
    "meaning": "草坪"
  },
  {
    "word": "lawyer",
    "phonetic": "[ˈlɔːjə(r)]",
    "meaning": "律师"
  },
  {
    "word": "lay",
    "phonetic": "[leɪ]",
    "meaning": "放置"
  },
  {
    "word": "layer",
    "phonetic": "[ˈleɪə(r)]",
    "meaning": "层"
  },
  {
    "word": "lazy",
    "phonetic": "[ˈleɪzi]",
    "meaning": "懒惰的"
  },
  {
    "word": "lead",
    "phonetic": "[liːd]",
    "meaning": "领导"
  },
  {
    "word": "leader",
    "phonetic": "[ˈliːdə(r)]",
    "meaning": "领导者"
  },
  {
    "word": "leadership",
    "phonetic": "[ˈliːdəʃɪp]",
    "meaning": "领导"
  },
  {
    "word": "leading",
    "phonetic": "[ˈliːdɪŋ]",
    "meaning": "主要的"
  },
  {
    "word": "leaf",
    "phonetic": "[liːf]",
    "meaning": "叶子"
  },
  {
    "word": "league",
    "phonetic": "[liːɡ]",
    "meaning": "联盟"
  },
  {
    "word": "lean",
    "phonetic": "[liːn]",
    "meaning": "倾斜"
  },
  {
    "word": "learn",
    "phonetic": "[lɜːn]",
    "meaning": "学习"
  },
  {
    "word": "learning",
    "phonetic": "[ˈlɜːnɪŋ]",
    "meaning": "学习"
  },
  {
    "word": "least",
    "phonetic": "[liːst]",
    "meaning": "最少的"
  },
  {
    "word": "leather",
    "phonetic": "[ˈleðə(r)]",
    "meaning": "皮革"
  },
  {
    "word": "leave",
    "phonetic": "[liːv]",
    "meaning": "离开"
  },
  {
    "word": "lecture",
    "phonetic": "[ˈlektʃə(r)]",
    "meaning": "讲座"
  },
  {
    "word": "left",
    "phonetic": "[left]",
    "meaning": "左边的"
  },
  {
    "word": "leg",
    "phonetic": "[leɡ]",
    "meaning": "腿"
  },
  {
    "word": "legacy",
    "phonetic": "[ˈleɡəsi]",
    "meaning": "遗产"
  },
  {
    "word": "legal",
    "phonetic": "[ˈliːɡl]",
    "meaning": "法律的"
  },
  {
    "word": "legend",
    "phonetic": "[ˈledʒənd]",
    "meaning": "传说"
  },
  {
    "word": "legislation",
    "phonetic": "[ˌledʒɪsˈleɪʃn]",
    "meaning": "立法"
  },
  {
    "word": "legislature",
    "phonetic": "[ˈledʒɪsleɪtʃə(r)]",
    "meaning": "立法机构"
  },
  {
    "word": "leisure",
    "phonetic": "[ˈleʒə(r)]",
    "meaning": "闲暇"
  },
  {
    "word": "lemon",
    "phonetic": "[ˈlemən]",
    "meaning": "柠檬"
  },
  {
    "word": "lend",
    "phonetic": "[lend]",
    "meaning": "借出"
  },
  {
    "word": "length",
    "phonetic": "[leŋθ]",
    "meaning": "长度"
  },
  {
    "word": "lens",
    "phonetic": "[lenz]",
    "meaning": "透镜"
  },
  {
    "word": "less",
    "phonetic": "[les]",
    "meaning": "更少的"
  },
  {
    "word": "lesson",
    "phonetic": "[ˈlesn]",
    "meaning": "课"
  },
  {
    "word": "let",
    "phonetic": "[let]",
    "meaning": "让"
  },
  {
    "word": "letter",
    "phonetic": "[ˈletə(r)]",
    "meaning": "信"
  },
  {
    "word": "level",
    "phonetic": "[ˈlevl]",
    "meaning": "水平"
  },
  {
    "word": "lever",
    "phonetic": "[ˈliːvə(r)]",
    "meaning": "杠杆"
  },
  {
    "word": "liable",
    "phonetic": "[ˈlaɪəbl]",
    "meaning": "有责任的"
  },
  {
    "word": "liar",
    "phonetic": "[ˈlaɪə(r)]",
    "meaning": "说谎者"
  },
  {
    "word": "liberal",
    "phonetic": "[ˈlɪbərəl]",
    "meaning": "自由的"
  },
  {
    "word": "liberate",
    "phonetic": "[ˈlɪbəreɪt]",
    "meaning": "解放"
  },
  {
    "word": "liberation",
    "phonetic": "[ˌlɪbəˈreɪʃn]",
    "meaning": "解放"
  },
  {
    "word": "liberty",
    "phonetic": "[ˈlɪbəti]",
    "meaning": "自由"
  },
  {
    "word": "library",
    "phonetic": "[ˈlaɪbrəri]",
    "meaning": "图书馆"
  },
  {
    "word": "license",
    "phonetic": "[ˈlaɪsns]",
    "meaning": "许可证"
  },
  {
    "word": "licence",
    "phonetic": "[ˈlaɪsns]",
    "meaning": "许可证"
  },
  {
    "word": "lick",
    "phonetic": "[lɪk]",
    "meaning": "舔"
  },
  {
    "word": "lie",
    "phonetic": "[laɪ]",
    "meaning": "说谎"
  },
  {
    "word": "life",
    "phonetic": "[laɪf]",
    "meaning": "生命"
  },
  {
    "word": "lifestyle",
    "phonetic": "[ˈlaɪfstaɪl]",
    "meaning": "生活方式"
  },
  {
    "word": "lift",
    "phonetic": "[lɪft]",
    "meaning": "举起"
  },
  {
    "word": "light",
    "phonetic": "[laɪt]",
    "meaning": "光"
  },
  {
    "word": "lightning",
    "phonetic": "[ˈlaɪtnɪŋ]",
    "meaning": "闪电"
  },
  {
    "word": "like",
    "phonetic": "[laɪk]",
    "meaning": "喜欢"
  },
  {
    "word": "likely",
    "phonetic": "[ˈlaɪkli]",
    "meaning": "可能的"
  },
  {
    "word": "limb",
    "phonetic": "[lɪm]",
    "meaning": "肢体"
  },
  {
    "word": "limit",
    "phonetic": "[ˈlɪmɪt]",
    "meaning": "限制"
  },
  {
    "word": "limited",
    "phonetic": "[ˈlɪmɪtɪd]",
    "meaning": "有限的"
  },
  {
    "word": "limitation",
    "phonetic": "[ˌlɪmɪˈteɪʃn]",
    "meaning": "限制"
  },
  {
    "word": "line",
    "phonetic": "[laɪn]",
    "meaning": "线"
  },
  {
    "word": "link",
    "phonetic": "[lɪŋk]",
    "meaning": "连接"
  },
  {
    "word": "lion",
    "phonetic": "[ˈlaɪən]",
    "meaning": "狮子"
  },
  {
    "word": "lip",
    "phonetic": "[lɪp]",
    "meaning": "嘴唇"
  },
  {
    "word": "liquid",
    "phonetic": "[ˈlɪkwɪd]",
    "meaning": "液体"
  },
  {
    "word": "list",
    "phonetic": "[lɪst]",
    "meaning": "列表"
  },
  {
    "word": "listen",
    "phonetic": "[ˈlɪsn]",
    "meaning": "听"
  },
  {
    "word": "literary",
    "phonetic": "[ˈlɪtrəri]",
    "meaning": "文学的"
  },
  {
    "word": "literature",
    "phonetic": "[ˈlɪtrətʃə(r)]",
    "meaning": "文学"
  },
  {
    "word": "litre",
    "phonetic": "[ˈliːtə(r)]",
    "meaning": "升"
  },
  {
    "word": "liter",
    "phonetic": "[ˈliːtə(r)]",
    "meaning": "升"
  },
  {
    "word": "little",
    "phonetic": "[ˈlɪtl]",
    "meaning": "小的"
  },
  {
    "word": "live",
    "phonetic": "[lɪv]",
    "meaning": "居住"
  },
  {
    "word": "lively",
    "phonetic": "[ˈlaɪvli]",
    "meaning": "活泼的"
  },
  {
    "word": "liver",
    "phonetic": "[ˈlɪvə(r)]",
    "meaning": "肝脏"
  },
  {
    "word": "living",
    "phonetic": "[ˈlɪvɪŋ]",
    "meaning": "活着的"
  },
  {
    "word": "load",
    "phonetic": "[ləʊd]",
    "meaning": "装载"
  },
  {
    "word": "loaf",
    "phonetic": "[ləʊf]",
    "meaning": "一条面包"
  },
  {
    "word": "local",
    "phonetic": "[ˈləʊkl]",
    "meaning": "当地的"
  },
  {
    "word": "locate",
    "phonetic": "[ləʊˈkeɪt]",
    "meaning": "定位"
  },
  {
    "word": "location",
    "phonetic": "[ləʊˈkeɪʃn]",
    "meaning": "位置"
  },
  {
    "word": "lock",
    "phonetic": "[lɒk]",
    "meaning": "锁"
  },
  {
    "word": "logic",
    "phonetic": "[ˈlɒdʒɪk]",
    "meaning": "逻辑"
  },
  {
    "word": "logical",
    "phonetic": "[ˈlɒdʒɪkl]",
    "meaning": "逻辑的"
  },
  {
    "word": "lonely",
    "phonetic": "[ˈləʊnli]",
    "meaning": "孤独的"
  },
  {
    "word": "long",
    "phonetic": "[lɒŋ]",
    "meaning": "长的"
  },
  {
    "word": "longitude",
    "phonetic": "[ˈlɒŋɡɪtjuːd]",
    "meaning": "经度"
  },
  {
    "word": "look",
    "phonetic": "[lʊk]",
    "meaning": "看"
  },
  {
    "word": "loose",
    "phonetic": "[luːs]",
    "meaning": "松散的"
  },
  {
    "word": "loosen",
    "phonetic": "[ˈluːsn]",
    "meaning": "放松"
  },
  {
    "word": "lord",
    "phonetic": "[lɔːd]",
    "meaning": "贵族"
  },
  {
    "word": "lorry",
    "phonetic": "[ˈlɒri]",
    "meaning": "卡车"
  },
  {
    "word": "lose",
    "phonetic": "[luːz]",
    "meaning": "失去"
  },
  {
    "word": "loss",
    "phonetic": "[lɒs]",
    "meaning": "损失"
  },
  {
    "word": "lost",
    "phonetic": "[lɒst]",
    "meaning": "丢失的"
  },
  {
    "word": "lot",
    "phonetic": "[lɒt]",
    "meaning": "许多"
  },
  {
    "word": "lotion",
    "phonetic": "[ˈləʊʃn]",
    "meaning": "乳液"
  },
  {
    "word": "loud",
    "phonetic": "[laʊd]",
    "meaning": "大声的"
  },
  {
    "word": "love",
    "phonetic": "[lʌv]",
    "meaning": "爱"
  },
  {
    "word": "lovely",
    "phonetic": "[ˈlʌvli]",
    "meaning": "可爱的"
  },
  {
    "word": "lover",
    "phonetic": "[ˈlʌvə(r)]",
    "meaning": "爱好者"
  },
  {
    "word": "low",
    "phonetic": "[ləʊ]",
    "meaning": "低的"
  },
  {
    "word": "lower",
    "phonetic": "[ˈləʊə(r)]",
    "meaning": "降低"
  },
  {
    "word": "loyal",
    "phonetic": "[ˈlɔɪəl]",
    "meaning": "忠诚的"
  },
  {
    "word": "luck",
    "phonetic": "[lʌk]",
    "meaning": "运气"
  },
  {
    "word": "lucky",
    "phonetic": "[ˈlʌki]",
    "meaning": "幸运的"
  },
  {
    "word": "luggage",
    "phonetic": "[ˈlʌɡɪdʒ]",
    "meaning": "行李"
  },
  {
    "word": "lump",
    "phonetic": "[lʌmp]",
    "meaning": "肿块"
  },
  {
    "word": "lunch",
    "phonetic": "[lʌntʃ]",
    "meaning": "午餐"
  },
  {
    "word": "lung",
    "phonetic": "[lʌŋ]",
    "meaning": "肺"
  },
  {
    "word": "luxury",
    "phonetic": "[ˈlʌkʃəri]",
    "meaning": "奢侈"
  },
  {
    "word": "machine",
    "phonetic": "[məˈʃiːn]",
    "meaning": "机器"
  },
  {
    "word": "machinery",
    "phonetic": "[məˈʃiːnəri]",
    "meaning": "机械"
  },
  {
    "word": "mad",
    "phonetic": "[mæd]",
    "meaning": "疯狂的"
  },
  {
    "word": "madam",
    "phonetic": "[ˈmædəm]",
    "meaning": "夫人"
  },
  {
    "word": "madame",
    "phonetic": "[məˈdɑːm]",
    "meaning": "夫人"
  },
  {
    "word": "madness",
    "phonetic": "[ˈmædnəs]",
    "meaning": "疯狂"
  },
  {
    "word": "magazine",
    "phonetic": "[ˌmæɡəˈziːn]",
    "meaning": "杂志"
  },
  {
    "word": "magic",
    "phonetic": "[ˈmædʒɪk]",
    "meaning": "魔法"
  },
  {
    "word": "magical",
    "phonetic": "[ˈmædʒɪkl]",
    "meaning": "神奇的"
  },
  {
    "word": "magnet",
    "phonetic": "[ˈmæɡnɪt]",
    "meaning": "磁铁"
  },
  {
    "word": "magnetic",
    "phonetic": "[mæɡˈnetɪk]",
    "meaning": "有磁性的"
  },
  {
    "word": "magnificent",
    "phonetic": "[mæɡˈnɪfɪsnt]",
    "meaning": "壮丽的"
  },
  {
    "word": "magnify",
    "phonetic": "[ˈmæɡnɪfaɪ]",
    "meaning": "放大"
  },
  {
    "word": "magnitude",
    "phonetic": "[ˈmæɡnɪtjuːd]",
    "meaning": "大小"
  },
  {
    "word": "maid",
    "phonetic": "[meɪd]",
    "meaning": "女仆"
  },
  {
    "word": "mail",
    "phonetic": "[meɪl]",
    "meaning": "邮件"
  },
  {
    "word": "main",
    "phonetic": "[meɪn]",
    "meaning": "主要的"
  },
  {
    "word": "mainly",
    "phonetic": "[ˈmeɪnli]",
    "meaning": "主要地"
  },
  {
    "word": "mainland",
    "phonetic": "[ˈmeɪnlænd]",
    "meaning": "大陆"
  },
  {
    "word": "maintain",
    "phonetic": "[meɪnˈteɪn]",
    "meaning": "维持"
  },
  {
    "word": "maintenance",
    "phonetic": "[ˈmeɪntənəns]",
    "meaning": "维护"
  },
  {
    "word": "major",
    "phonetic": "[ˈmeɪdʒə(r)]",
    "meaning": "主要的"
  },
  {
    "word": "majority",
    "phonetic": "[məˈdʒɒrəti]",
    "meaning": "大多数"
  },
  {
    "word": "make",
    "phonetic": "[meɪk]",
    "meaning": "制作"
  },
  {
    "word": "maker",
    "phonetic": "[ˈmeɪkə(r)]",
    "meaning": "制造者"
  },
  {
    "word": "male",
    "phonetic": "[meɪl]",
    "meaning": "男性的"
  },
  {
    "word": "mall",
    "phonetic": "[mɔːl]",
    "meaning": "购物中心"
  },
  {
    "word": "man",
    "phonetic": "[mæn]",
    "meaning": "男人"
  },
  {
    "word": "manage",
    "phonetic": "[ˈmænɪdʒ]",
    "meaning": "管理"
  },
  {
    "word": "management",
    "phonetic": "[ˈmænɪdʒmənt]",
    "meaning": "管理"
  },
  {
    "word": "manager",
    "phonetic": "[ˈmænɪdʒə(r)]",
    "meaning": "经理"
  },
  {
    "word": "mankind",
    "phonetic": "[mænˈkaɪnd]",
    "meaning": "人类"
  },
  {
    "word": "manly",
    "phonetic": "[ˈmænli]",
    "meaning": "有男子气概的"
  },
  {
    "word": "manner",
    "phonetic": "[ˈmænə(r)]",
    "meaning": "方式"
  },
  {
    "word": "manual",
    "phonetic": "[ˈmænjuəl]",
    "meaning": "手册"
  },
  {
    "word": "manufacture",
    "phonetic": "[ˌmænjuˈfæktʃə(r)]",
    "meaning": "制造"
  },
  {
    "word": "manufacturer",
    "phonetic": "[ˌmænjuˈfæktʃərə(r)]",
    "meaning": "制造商"
  },
  {
    "word": "manufacturing",
    "phonetic": "[ˌmænjuˈfæktʃərɪŋ]",
    "meaning": "制造业"
  },
  {
    "word": "many",
    "phonetic": "[ˈmeni]",
    "meaning": "许多"
  },
  {
    "word": "map",
    "phonetic": "[mæp]",
    "meaning": "地图"
  },
  {
    "word": "march",
    "phonetic": "[mɑːtʃ]",
    "meaning": "三月"
  },
  {
    "word": "mark",
    "phonetic": "[mɑːk]",
    "meaning": "标记"
  },
  {
    "word": "market",
    "phonetic": "[ˈmɑːkɪt]",
    "meaning": "市场"
  },
  {
    "word": "marketing",
    "phonetic": "[ˈmɑːkɪtɪŋ]",
    "meaning": "市场营销"
  },
  {
    "word": "marriage",
    "phonetic": "[ˈmærɪdʒ]",
    "meaning": "婚姻"
  },
  {
    "word": "married",
    "phonetic": "[ˈmærid]",
    "meaning": "已婚的"
  },
  {
    "word": "marry",
    "phonetic": "[ˈmæri]",
    "meaning": "结婚"
  },
  {
    "word": "marvel",
    "phonetic": "[ˈmɑːvl]",
    "meaning": "奇迹"
  },
  {
    "word": "marvellous",
    "phonetic": "[ˈmɑːvələs]",
    "meaning": "奇妙的"
  },
  {
    "word": "mask",
    "phonetic": "[mɑːsk]",
    "meaning": "面具"
  },
  {
    "word": "mass",
    "phonetic": "[mæs]",
    "meaning": "质量"
  },
  {
    "word": "massage",
    "phonetic": "[ˈmæsɑːʒ]",
    "meaning": "按摩"
  },
  {
    "word": "massive",
    "phonetic": "[ˈmæsɪv]",
    "meaning": "巨大的"
  },
  {
    "word": "master",
    "phonetic": "[ˈmɑːstə(r)]",
    "meaning": "掌握"
  },
  {
    "word": "match",
    "phonetic": "[mætʃ]",
    "meaning": "比赛"
  },
  {
    "word": "material",
    "phonetic": "[məˈtɪəriəl]",
    "meaning": "材料"
  },
  {
    "word": "mathematical",
    "phonetic": "[ˌmæθəˈmætɪkl]",
    "meaning": "数学的"
  },
  {
    "word": "mathematics",
    "phonetic": "[ˌmæθəˈmætɪks]",
    "meaning": "数学"
  },
  {
    "word": "maths",
    "phonetic": "[mæθs]",
    "meaning": "数学"
  },
  {
    "word": "matter",
    "phonetic": "[ˈmætə(r)]",
    "meaning": "事情"
  },
  {
    "word": "mature",
    "phonetic": "[məˈtʃʊə(r)]",
    "meaning": "成熟的"
  },
  {
    "word": "maximum",
    "phonetic": "[ˈmæksɪməm]",
    "meaning": "最大值"
  },
  {
    "word": "may",
    "phonetic": "[meɪ]",
    "meaning": "可能"
  },
  {
    "word": "maybe",
    "phonetic": "[ˈmeɪbi]",
    "meaning": "也许"
  },
  {
    "word": "mayor",
    "phonetic": "[meə(r)]",
    "meaning": "市长"
  },
  {
    "word": "me",
    "phonetic": "[miː]",
    "meaning": "我"
  },
  {
    "word": "meal",
    "phonetic": "[miːl]",
    "meaning": "餐"
  },
  {
    "word": "mean",
    "phonetic": "[miːn]",
    "meaning": "意思是"
  },
  {
    "word": "meaning",
    "phonetic": "[ˈmiːnɪŋ]",
    "meaning": "意义"
  },
  {
    "word": "means",
    "phonetic": "[miːnz]",
    "meaning": "方法"
  },
  {
    "word": "meant",
    "phonetic": "[ment]",
    "meaning": "意味着"
  },
  {
    "word": "measure",
    "phonetic": "[ˈmeʒə(r)]",
    "meaning": "测量"
  },
  {
    "word": "measurement",
    "phonetic": "[ˈmeʒəmənt]",
    "meaning": "测量"
  },
  {
    "word": "meat",
    "phonetic": "[miːt]",
    "meaning": "肉"
  },
  {
    "word": "mechanic",
    "phonetic": "[məˈkænɪk]",
    "meaning": "机械师"
  },
  {
    "word": "mechanical",
    "phonetic": "[məˈkænɪkl]",
    "meaning": "机械的"
  },
  {
    "word": "mechanism",
    "phonetic": "[ˈmekənɪzəm]",
    "meaning": "机制"
  },
  {
    "word": "media",
    "phonetic": "[ˈmiːdiə]",
    "meaning": "媒体"
  },
  {
    "word": "medical",
    "phonetic": "[ˈmedɪkl]",
    "meaning": "医疗的"
  },
  {
    "word": "medicine",
    "phonetic": "[ˈmedsn]",
    "meaning": "医学"
  },
  {
    "word": "medium",
    "phonetic": "[ˈmiːdiəm]",
    "meaning": "中等的"
  },
  {
    "word": "meet",
    "phonetic": "[miːt]",
    "meaning": "遇见"
  },
  {
    "word": "meeting",
    "phonetic": "[ˈmiːtɪŋ]",
    "meaning": "会议"
  },
  {
    "word": "melt",
    "phonetic": "[melt]",
    "meaning": "融化"
  },
  {
    "word": "member",
    "phonetic": "[ˈmembə(r)]",
    "meaning": "成员"
  },
  {
    "word": "membership",
    "phonetic": "[ˈmembəʃɪp]",
    "meaning": "会员资格"
  },
  {
    "word": "memo",
    "phonetic": "[ˈmeməʊ]",
    "meaning": "备忘录"
  },
  {
    "word": "memorial",
    "phonetic": "[məˈmɔːriəl]",
    "meaning": "纪念的"
  },
  {
    "word": "memory",
    "phonetic": "[ˈmeməri]",
    "meaning": "记忆"
  },
  {
    "word": "men",
    "phonetic": "[men]",
    "meaning": "男人"
  },
  {
    "word": "mental",
    "phonetic": "[ˈmentl]",
    "meaning": "精神的"
  },
  {
    "word": "mention",
    "phonetic": "[ˈmenʃn]",
    "meaning": "提及"
  },
  {
    "word": "menu",
    "phonetic": "[ˈmenjuː]",
    "meaning": "菜单"
  },
  {
    "word": "merchandise",
    "phonetic": "[ˈmɜːtʃəndaɪs]",
    "meaning": "商品"
  },
  {
    "word": "merchant",
    "phonetic": "[ˈmɜːtʃənt]",
    "meaning": "商人"
  },
  {
    "word": "mercury",
    "phonetic": "[ˈmɜːkjəri]",
    "meaning": "水银"
  },
  {
    "word": "mercy",
    "phonetic": "[ˈmɜːsi]",
    "meaning": "仁慈"
  },
  {
    "word": "mere",
    "phonetic": "[mɪə(r)]",
    "meaning": "仅仅"
  },
  {
    "word": "merely",
    "phonetic": "[ˈmɪəli]",
    "meaning": "仅仅"
  },
  {
    "word": "merge",
    "phonetic": "[mɜːdʒ]",
    "meaning": "合并"
  },
  {
    "word": "merit",
    "phonetic": "[ˈmerɪt]",
    "meaning": "优点"
  },
  {
    "word": "merry",
    "phonetic": "[ˈmeri]",
    "meaning": "快乐的"
  },
  {
    "word": "mess",
    "phonetic": "[mes]",
    "meaning": "混乱"
  },
  {
    "word": "message",
    "phonetic": "[ˈmesɪdʒ]",
    "meaning": "消息"
  },
  {
    "word": "messenger",
    "phonetic": "[ˈmesɪndʒə(r)]",
    "meaning": "信使"
  },
  {
    "word": "metal",
    "phonetic": "[ˈmetl]",
    "meaning": "金属"
  },
  {
    "word": "meter",
    "phonetic": "[ˈmiːtə(r)]",
    "meaning": "米"
  },
  {
    "word": "method",
    "phonetic": "[ˈmeθəd]",
    "meaning": "方法"
  },
  {
    "word": "metre",
    "phonetic": "[ˈmiːtə(r)]",
    "meaning": "米"
  },
  {
    "word": "metric",
    "phonetic": "[ˈmetrɪk]",
    "meaning": "公制的"
  },
  {
    "word": "metropolitan",
    "phonetic": "[ˌmetrəˈpɒlɪtən]",
    "meaning": "大都市的"
  },
  {
    "word": "microphone",
    "phonetic": "[ˈmaɪkrəfəʊn]",
    "meaning": "麦克风"
  },
  {
    "word": "microscope",
    "phonetic": "[ˈmaɪkrəskəʊp]",
    "meaning": "显微镜"
  },
  {
    "word": "middle",
    "phonetic": "[ˈmɪdl]",
    "meaning": "中间的"
  },
  {
    "word": "midnight",
    "phonetic": "[ˈmɪdnaɪt]",
    "meaning": "午夜"
  },
  {
    "word": "mild",
    "phonetic": "[maɪld]",
    "meaning": "温和的"
  },
  {
    "word": "mile",
    "phonetic": "[maɪl]",
    "meaning": "英里"
  },
  {
    "word": "milk",
    "phonetic": "[mɪlk]",
    "meaning": "牛奶"
  },
  {
    "word": "mill",
    "phonetic": "[mɪl]",
    "meaning": "磨坊"
  },
  {
    "word": "millimetre",
    "phonetic": "[ˈmɪlimiːtə(r)]",
    "meaning": "毫米"
  },
  {
    "word": "million",
    "phonetic": "[ˈmɪljən]",
    "meaning": "百万"
  },
  {
    "word": "millions",
    "phonetic": "[ˈmɪljənz]",
    "meaning": "数百万"
  },
  {
    "word": "millionaire",
    "phonetic": "[ˌmɪljəˈneə(r)]",
    "meaning": "百万富翁"
  },
  {
    "word": "mind",
    "phonetic": "[maɪnd]",
    "meaning": "思想"
  },
  {
    "word": "mine",
    "phonetic": "[maɪn]",
    "meaning": "我的"
  },
  {
    "word": "miner",
    "phonetic": "[ˈmaɪnə(r)]",
    "meaning": "矿工"
  },
  {
    "word": "mineral",
    "phonetic": "[ˈmɪnərəl]",
    "meaning": "矿物"
  },
  {
    "word": "mingle",
    "phonetic": "[ˈmɪŋɡl]",
    "meaning": "混合"
  },
  {
    "word": "miniature",
    "phonetic": "[ˈmɪnətʃə(r)]",
    "meaning": "微型的"
  },
  {
    "word": "minibus",
    "phonetic": "[ˈmɪnibʌs]",
    "meaning": "小型巴士"
  },
  {
    "word": "minimize",
    "phonetic": "[ˈmɪnɪmaɪz]",
    "meaning": "最小化"
  },
  {
    "word": "minimum",
    "phonetic": "[ˈmɪnɪməm]",
    "meaning": "最小值"
  },
  {
    "word": "minister",
    "phonetic": "[ˈmɪnɪstə(r)]",
    "meaning": "部长"
  },
  {
    "word": "ministry",
    "phonetic": "[ˈmɪnɪstri]",
    "meaning": "部门"
  },
  {
    "word": "minor",
    "phonetic": "[ˈmaɪnə(r)]",
    "meaning": "次要的"
  },
  {
    "word": "minority",
    "phonetic": "[maɪˈnɒrəti]",
    "meaning": "少数"
  },
  {
    "word": "minute",
    "phonetic": "[ˈmɪnɪt]",
    "meaning": "分钟"
  },
  {
    "word": "miracle",
    "phonetic": "[ˈmɪrəkl]",
    "meaning": "奇迹"
  },
  {
    "word": "miraculous",
    "phonetic": "[mɪˈrækjələs]",
    "meaning": "奇迹般的"
  },
  {
    "word": "mirror",
    "phonetic": "[ˈmɪrə(r)]",
    "meaning": "镜子"
  },
  {
    "word": "miserable",
    "phonetic": "[ˈmɪzrəbl]",
    "meaning": "悲惨的"
  },
  {
    "word": "misery",
    "phonetic": "[ˈmɪzəri]",
    "meaning": "痛苦"
  },
  {
    "word": "misfortune",
    "phonetic": "[mɪsˈfɔːtʃuːn]",
    "meaning": "不幸"
  },
  {
    "word": "mislead",
    "phonetic": "[ˌmɪsˈliːd]",
    "meaning": "误导"
  },
  {
    "word": "miss",
    "phonetic": "[mɪs]",
    "meaning": "错过"
  },
  {
    "word": "missing",
    "phonetic": "[ˈmɪsɪŋ]",
    "meaning": "失踪的"
  },
  {
    "word": "mission",
    "phonetic": "[ˈmɪʃn]",
    "meaning": "任务"
  },
  {
    "word": "mistake",
    "phonetic": "[məˈsteɪk]",
    "meaning": "错误"
  },
  {
    "word": "mistaken",
    "phonetic": "[məˈsteɪkən]",
    "meaning": "错误的"
  },
  {
    "word": "mix",
    "phonetic": "[mɪks]",
    "meaning": "混合"
  },
  {
    "word": "mixture",
    "phonetic": "[ˈmɪkstʃə(r)]",
    "meaning": "混合物"
  },
  {
    "word": "mobile",
    "phonetic": "[ˈməʊbaɪl]",
    "meaning": "可移动的"
  },
  {
    "word": "mode",
    "phonetic": "[məʊd]",
    "meaning": "方式"
  },
  {
    "word": "model",
    "phonetic": "[ˈmɒdl]",
    "meaning": "模型"
  },
  {
    "word": "moderate",
    "phonetic": "[ˈmɒdərət]",
    "meaning": "适度的"
  },
  {
    "word": "modern",
    "phonetic": "[ˈmɒdn]",
    "meaning": "现代的"
  },
  {
    "word": "modest",
    "phonetic": "[ˈmɒdɪst]",
    "meaning": "谦虚的"
  },
  {
    "word": "modify",
    "phonetic": "[ˈmɒdɪfaɪ]",
    "meaning": "修改"
  },
  {
    "word": "moist",
    "phonetic": "[mɔɪst]",
    "meaning": "潮湿的"
  },
  {
    "word": "moisture",
    "phonetic": "[ˈmɔɪstʃə(r)]",
    "meaning": "水分"
  },
  {
    "word": "molecule",
    "phonetic": "[ˈmɒlɪkjuːl]",
    "meaning": "分子"
  },
  {
    "word": "moment",
    "phonetic": "[ˈməʊmənt]",
    "meaning": "时刻"
  },
  {
    "word": "momentary",
    "phonetic": "[ˈməʊməntri]",
    "meaning": "短暂的"
  },
  {
    "word": "Monday",
    "phonetic": "[ˈmʌndeɪ]",
    "meaning": "星期一"
  },
  {
    "word": "money",
    "phonetic": "[ˈmʌni]",
    "meaning": "钱"
  },
  {
    "word": "monitor",
    "phonetic": "[ˈmɒnɪtə(r)]",
    "meaning": "监视器"
  },
  {
    "word": "monkey",
    "phonetic": "[ˈmʌŋki]",
    "meaning": "猴子"
  },
  {
    "word": "month",
    "phonetic": "[mʌnθ]",
    "meaning": "月"
  },
  {
    "word": "monthly",
    "phonetic": "[ˈmʌnθli]",
    "meaning": "每月的"
  },
  {
    "word": "monument",
    "phonetic": "[ˈmɒnjumənt]",
    "meaning": "纪念碑"
  },
  {
    "word": "moon",
    "phonetic": "[muːn]",
    "meaning": "月亮"
  },
  {
    "word": "moral",
    "phonetic": "[ˈmɒrəl]",
    "meaning": "道德的"
  },
  {
    "word": "more",
    "phonetic": "[mɔː(r)]",
    "meaning": "更多的"
  },
  {
    "word": "moreover",
    "phonetic": "[mɔːrˈəʊvə(r)]",
    "meaning": "此外"
  },
  {
    "word": "morning",
    "phonetic": "[ˈmɔːnɪŋ]",
    "meaning": "早晨"
  },
  {
    "word": "mosquito",
    "phonetic": "[məˈskiːtəʊ]",
    "meaning": "蚊子"
  },
  {
    "word": "most",
    "phonetic": "[məʊst]",
    "meaning": "最多的"
  },
  {
    "word": "mostly",
    "phonetic": "[ˈməʊstli]",
    "meaning": "主要地"
  },
  {
    "word": "mother",
    "phonetic": "[ˈmʌðə(r)]",
    "meaning": "母亲"
  },
  {
    "word": "motion",
    "phonetic": "[ˈməʊʃn]",
    "meaning": "动作"
  },
  {
    "word": "motivate",
    "phonetic": "[ˈməʊtɪveɪt]",
    "meaning": "激励"
  },
  {
    "word": "motivation",
    "phonetic": "[ˌməʊtɪˈveɪʃn]",
    "meaning": "动机"
  },
  {
    "word": "motive",
    "phonetic": "[ˈməʊtɪv]",
    "meaning": "动机"
  },
  {
    "word": "motor",
    "phonetic": "[ˈməʊtə(r)]",
    "meaning": "发动机"
  },
  {
    "word": "motorcycle",
    "phonetic": "[ˈməʊtəsaɪkl]",
    "meaning": "摩托车"
  },
  {
    "word": "mountain",
    "phonetic": "[ˈmaʊntən]",
    "meaning": "山"
  },
  {
    "word": "mountainous",
    "phonetic": "[ˈmaʊntənəs]",
    "meaning": "多山的"
  },
  {
    "word": "mouse",
    "phonetic": "[maʊs]",
    "meaning": "老鼠"
  },
  {
    "word": "mouth",
    "phonetic": "[maʊθ]",
    "meaning": "嘴"
  },
  {
    "word": "move",
    "phonetic": "[muːv]",
    "meaning": "移动"
  },
  {
    "word": "movement",
    "phonetic": "[ˈmuːvmənt]",
    "meaning": "运动"
  },
  {
    "word": "movie",
    "phonetic": "[ˈmuːvi]",
    "meaning": "电影"
  },
  {
    "word": "moving",
    "phonetic": "[ˈmuːvɪŋ]",
    "meaning": "感人的"
  },
  {
    "word": "mud",
    "phonetic": "[mʌd]",
    "meaning": "泥"
  },
  {
    "word": "mug",
    "phonetic": "[mʌɡ]",
    "meaning": "杯子"
  },
  {
    "word": "multiply",
    "phonetic": "[ˈmʌltɪplaɪ]",
    "meaning": "乘"
  },
  {
    "word": "multitude",
    "phonetic": "[ˈmʌltɪtjuːd]",
    "meaning": "大量"
  },
  {
    "word": "municipal",
    "phonetic": "[mjuːˈnɪsɪpl]",
    "meaning": "市政的"
  },
  {
    "word": "murder",
    "phonetic": "[ˈmɜːdə(r)]",
    "meaning": "谋杀"
  },
  {
    "word": "muscle",
    "phonetic": "[ˈmʌsl]",
    "meaning": "肌肉"
  },
  {
    "word": "museum",
    "phonetic": "[mjuːˈziːəm]",
    "meaning": "博物馆"
  },
  {
    "word": "mushroom",
    "phonetic": "[ˈmʌʃrʊm]",
    "meaning": "蘑菇"
  },
  {
    "word": "music",
    "phonetic": "[ˈmjuːzɪk]",
    "meaning": "音乐"
  },
  {
    "word": "musical",
    "phonetic": "[ˈmjuːzɪkl]",
    "meaning": "音乐的"
  },
  {
    "word": "musician",
    "phonetic": "[mjuːˈzɪʃn]",
    "meaning": "音乐家"
  },
  {
    "word": "must",
    "phonetic": "[mʌst]",
    "meaning": "必须"
  },
  {
    "word": "mustard",
    "phonetic": "[ˈmʌstəd]",
    "meaning": "芥末"
  },
  {
    "word": "mutual",
    "phonetic": "[ˈmjuːtʃuəl]",
    "meaning": "相互的"
  },
  {
    "word": "my",
    "phonetic": "[maɪ]",
    "meaning": "我的"
  },
  {
    "word": "myself",
    "phonetic": "[maɪˈself]",
    "meaning": "我自己"
  },
  {
    "word": "mysterious",
    "phonetic": "[mɪˈstɪəriəs]",
    "meaning": "神秘的"
  },
  {
    "word": "mystery",
    "phonetic": "[ˈmɪstri]",
    "meaning": "神秘"
  },
  {
    "word": "myth",
    "phonetic": "[mɪθ]",
    "meaning": "神话"
  },
  {
    "word": "nail",
    "phonetic": "[neɪl]",
    "meaning": "钉子"
  },
  {
    "word": "name",
    "phonetic": "[neɪm]",
    "meaning": "名字"
  },
  {
    "word": "namely",
    "phonetic": "[ˈneɪmli]",
    "meaning": "即"
  },
  {
    "word": "nap",
    "phonetic": "[næp]",
    "meaning": "小睡"
  },
  {
    "word": "narrow",
    "phonetic": "[ˈnærəʊ]",
    "meaning": "狭窄的"
  },
  {
    "word": "nation",
    "phonetic": "[ˈneɪʃn]",
    "meaning": "国家"
  },
  {
    "word": "national",
    "phonetic": "[ˈnæʃnəl]",
    "meaning": "国家的"
  },
  {
    "word": "native",
    "phonetic": "[ˈneɪtɪv]",
    "meaning": "本土的"
  },
  {
    "word": "natural",
    "phonetic": "[ˈnætʃrəl]",
    "meaning": "自然的"
  },
  {
    "word": "naturally",
    "phonetic": "[ˈnætʃrəli]",
    "meaning": "自然地"
  },
  {
    "word": "nature",
    "phonetic": "[ˈneɪtʃə(r)]",
    "meaning": "自然"
  },
  {
    "word": "naughty",
    "phonetic": "[ˈnɔːti]",
    "meaning": "淘气的"
  },
  {
    "word": "navy",
    "phonetic": "[ˈneɪvi]",
    "meaning": "海军"
  },
  {
    "word": "near",
    "phonetic": "[nɪə(r)]",
    "meaning": "近的"
  },
  {
    "word": "nearby",
    "phonetic": "[ˌnɪəˈbaɪ]",
    "meaning": "附近的"
  },
  {
    "word": "nearly",
    "phonetic": "[ˈnɪəli]",
    "meaning": "几乎"
  },
  {
    "word": "neat",
    "phonetic": "[niːt]",
    "meaning": "整洁的"
  },
  {
    "word": "necessarily",
    "phonetic": "[ˌnesəˈserəli]",
    "meaning": "必然地"
  },
  {
    "word": "necessary",
    "phonetic": "[ˈnesəsəri]",
    "meaning": "必要的"
  },
  {
    "word": "necessity",
    "phonetic": "[nəˈsesəti]",
    "meaning": "必要性"
  },
  {
    "word": "neck",
    "phonetic": "[nek]",
    "meaning": "脖子"
  },
  {
    "word": "need",
    "phonetic": "[niːd]",
    "meaning": "需要"
  },
  {
    "word": "needle",
    "phonetic": "[ˈniːdl]",
    "meaning": "针"
  },
  {
    "word": "negative",
    "phonetic": "[ˈneɡətɪv]",
    "meaning": "消极的"
  },
  {
    "word": "neglect",
    "phonetic": "[nɪˈɡlekt]",
    "meaning": "忽视"
  },
  {
    "word": "negotiate",
    "phonetic": "[nɪˈɡəʊʃieɪt]",
    "meaning": "谈判"
  },
  {
    "word": "negotiation",
    "phonetic": "[nɪˌɡəʊʃiˈeɪʃn]",
    "meaning": "谈判"
  },
  {
    "word": "neither",
    "phonetic": "[ˈnaɪðə(r)]",
    "meaning": "两者都不"
  },
  {
    "word": "nephew",
    "phonetic": "[ˈnefjuː]",
    "meaning": "侄子"
  },
  {
    "word": "nerve",
    "phonetic": "[nɜːv]",
    "meaning": "神经"
  },
  {
    "word": "nervous",
    "phonetic": "[ˈnɜːvəs]",
    "meaning": "紧张的"
  },
  {
    "word": "nest",
    "phonetic": "[nest]",
    "meaning": "鸟巢"
  },
  {
    "word": "net",
    "phonetic": "[net]",
    "meaning": "网"
  },
  {
    "word": "network",
    "phonetic": "[ˈnetwɜːk]",
    "meaning": "网络"
  },
  {
    "word": "never",
    "phonetic": "[ˈnevə(r)]",
    "meaning": "从不"
  },
  {
    "word": "nevertheless",
    "phonetic": "[ˌnevəðəˈles]",
    "meaning": "然而"
  },
  {
    "word": "new",
    "phonetic": "[njuː]",
    "meaning": "新的"
  },
  {
    "word": "news",
    "phonetic": "[njuːz]",
    "meaning": "新闻"
  },
  {
    "word": "newspaper",
    "phonetic": "[ˈnjuːzpeɪpə(r)]",
    "meaning": "报纸"
  },
  {
    "word": "next",
    "phonetic": "[nekst]",
    "meaning": "下一个"
  },
  {
    "word": "nice",
    "phonetic": "[naɪs]",
    "meaning": "好的"
  },
  {
    "word": "niece",
    "phonetic": "[niːs]",
    "meaning": "侄女"
  },
  {
    "word": "night",
    "phonetic": "[naɪt]",
    "meaning": "夜晚"
  },
  {
    "word": "nightmare",
    "phonetic": "[ˈnaɪtmeə(r)]",
    "meaning": "噩梦"
  },
  {
    "word": "nine",
    "phonetic": "[naɪn]",
    "meaning": "九"
  },
  {
    "word": "nineteen",
    "phonetic": "[ˌnaɪnˈtiːn]",
    "meaning": "十九"
  },
  {
    "word": "ninety",
    "phonetic": "[ˈnaɪnti]",
    "meaning": "九十"
  },
  {
    "word": "ninth",
    "phonetic": "[naɪnθ]",
    "meaning": "第九"
  },
  {
    "word": "noble",
    "phonetic": "[ˈnəʊbl]",
    "meaning": "高尚的"
  },
  {
    "word": "nobody",
    "phonetic": "[ˈnəʊbədi]",
    "meaning": "没有人"
  },
  {
    "word": "nod",
    "phonetic": "[nɒd]",
    "meaning": "点头"
  },
  {
    "word": "noise",
    "phonetic": "[nɔɪz]",
    "meaning": "噪音"
  },
  {
    "word": "noisy",
    "phonetic": "[ˈnɔɪzi]",
    "meaning": "嘈杂的"
  },
  {
    "word": "none",
    "phonetic": "[nʌn]",
    "meaning": "没有"
  },
  {
    "word": "nonsense",
    "phonetic": "[ˈnɒnsns]",
    "meaning": "胡说"
  },
  {
    "word": "noon",
    "phonetic": "[nuːn]",
    "meaning": "中午"
  },
  {
    "word": "nor",
    "phonetic": "[nɔː(r)]",
    "meaning": "也不"
  },
  {
    "word": "normal",
    "phonetic": "[ˈnɔːml]",
    "meaning": "正常的"
  },
  {
    "word": "normally",
    "phonetic": "[ˈnɔːməli]",
    "meaning": "正常地"
  },
  {
    "word": "north",
    "phonetic": "[nɔːθ]",
    "meaning": "北"
  },
  {
    "word": "northern",
    "phonetic": "[ˈnɔːðən]",
    "meaning": "北方的"
  },
  {
    "word": "northwest",
    "phonetic": "[ˌnɔːθˈwest]",
    "meaning": "西北"
  },
  {
    "word": "nose",
    "phonetic": "[nəʊz]",
    "meaning": "鼻子"
  },
  {
    "word": "not",
    "phonetic": "[nɒt]",
    "meaning": "不"
  },
  {
    "word": "note",
    "phonetic": "[nəʊt]",
    "meaning": "笔记"
  },
  {
    "word": "notebook",
    "phonetic": "[ˈnəʊtbʊk]",
    "meaning": "笔记本"
  },
  {
    "word": "nothing",
    "phonetic": "[ˈnʌθɪŋ]",
    "meaning": "没有什么"
  },
  {
    "word": "notice",
    "phonetic": "[ˈnəʊtɪs]",
    "meaning": "注意到"
  },
  {
    "word": "notification",
    "phonetic": "[ˌnəʊtɪfɪˈkeɪʃn]",
    "meaning": "通知"
  },
  {
    "word": "notion",
    "phonetic": "[ˈnəʊʃn]",
    "meaning": "概念"
  },
  {
    "word": "novel",
    "phonetic": "[ˈnɒvl]",
    "meaning": "小说"
  },
  {
    "word": "now",
    "phonetic": "[naʊ]",
    "meaning": "现在"
  },
  {
    "word": "nowadays",
    "phonetic": "[ˈnaʊədeɪz]",
    "meaning": "如今"
  },
  {
    "word": "nowhere",
    "phonetic": "[ˈnəʊweə(r)]",
    "meaning": "无处"
  },
  {
    "word": "nuclear",
    "phonetic": "[ˈnjuːkliə(r)]",
    "meaning": "核的"
  },
  {
    "word": "number",
    "phonetic": "[ˈnʌmbə(r)]",
    "meaning": "数字"
  },
  {
    "word": "numerous",
    "phonetic": "[ˈnjuːmərəs]",
    "meaning": "许多的"
  },
  {
    "word": "nurse",
    "phonetic": "[nɜːs]",
    "meaning": "护士"
  },
  {
    "word": "nursery",
    "phonetic": "[ˈnɜːsəri]",
    "meaning": "托儿所"
  },
  {
    "word": "nut",
    "phonetic": "[nʌt]",
    "meaning": "坚果"
  },
  {
    "word": "nutrition",
    "phonetic": "[njuˈtrɪʃn]",
    "meaning": "营养"
  },
  {
    "word": "nylon",
    "phonetic": "[ˈnaɪlɒn]",
    "meaning": "尼龙"
  },
  {
    "word": "oak",
    "phonetic": "[əʊk]",
    "meaning": "橡树"
  },
  {
    "word": "oar",
    "phonetic": "[ɔː(r)]",
    "meaning": "桨"
  },
  {
    "word": "oasis",
    "phonetic": "[əʊˈeɪsɪs]",
    "meaning": "绿洲"
  },
  {
    "word": "obey",
    "phonetic": "[əˈbeɪ]",
    "meaning": "服从"
  },
  {
    "word": "object",
    "phonetic": "[ˈɒbdʒɪkt]",
    "meaning": "物体"
  },
  {
    "word": "objective",
    "phonetic": "[əbˈdʒektɪv]",
    "meaning": "客观的"
  },
  {
    "word": "obligation",
    "phonetic": "[ˌɒblɪˈɡeɪʃn]",
    "meaning": "义务"
  },
  {
    "word": "oblige",
    "phonetic": "[əˈblaɪdʒ]",
    "meaning": "迫使"
  },
  {
    "word": "observation",
    "phonetic": "[ˌɒbzəˈveɪʃn]",
    "meaning": "观察"
  },
  {
    "word": "observe",
    "phonetic": "[əbˈzɜːv]",
    "meaning": "观察"
  },
  {
    "word": "observer",
    "phonetic": "[əbˈzɜːvə(r)]",
    "meaning": "观察者"
  },
  {
    "word": "obstacle",
    "phonetic": "[ˈɒbstəkl]",
    "meaning": "障碍"
  },
  {
    "word": "obtain",
    "phonetic": "[əbˈteɪn]",
    "meaning": "获得"
  },
  {
    "word": "obvious",
    "phonetic": "[ˈɒbviəs]",
    "meaning": "明显的"
  },
  {
    "word": "obviously",
    "phonetic": "[ˈɒbviəsli]",
    "meaning": "明显地"
  },
  {
    "word": "occasion",
    "phonetic": "[əˈkeɪʒn]",
    "meaning": "场合"
  },
  {
    "word": "occasional",
    "phonetic": "[əˈkeɪʒənl]",
    "meaning": "偶尔的"
  },
  {
    "word": "occasionally",
    "phonetic": "[əˈkeɪʒənəli]",
    "meaning": "偶尔"
  },
  {
    "word": "occupation",
    "phonetic": "[ˌɒkjuˈpeɪʃn]",
    "meaning": "职业"
  },
  {
    "word": "occupy",
    "phonetic": "[ˈɒkjupaɪ]",
    "meaning": "占据"
  },
  {
    "word": "occur",
    "phonetic": "[əˈkɜː(r)]",
    "meaning": "发生"
  },
  {
    "word": "occurrence",
    "phonetic": "[əˈkʌrəns]",
    "meaning": "发生"
  },
  {
    "word": "ocean",
    "phonetic": "[ˈəʊʃn]",
    "meaning": "海洋"
  },
  {
    "word": "o'clock",
    "phonetic": "[əˈklɒk]",
    "meaning": "点钟"
  },
  {
    "word": "October",
    "phonetic": "[ɒkˈtəʊbə(r)]",
    "meaning": "十月"
  },
  {
    "word": "odd",
    "phonetic": "[ɒd]",
    "meaning": "奇怪的"
  },
  {
    "word": "odds",
    "phonetic": "[ɒdz]",
    "meaning": "可能性"
  },
  {
    "word": "of",
    "phonetic": "[ɒv]",
    "meaning": "...的"
  },
  {
    "word": "off",
    "phonetic": "[ɒf]",
    "meaning": "离开"
  },
  {
    "word": "offence",
    "phonetic": "[əˈfens]",
    "meaning": "冒犯"
  },
  {
    "word": "offensive",
    "phonetic": "[əˈfensɪv]",
    "meaning": "冒犯的"
  },
  {
    "word": "offer",
    "phonetic": "[ˈɒfə(r)]",
    "meaning": "提供"
  },
  {
    "word": "office",
    "phonetic": "[ˈɒfɪs]",
    "meaning": "办公室"
  },
  {
    "word": "officer",
    "phonetic": "[ˈɒfɪsə(r)]",
    "meaning": "官员"
  },
  {
    "word": "official",
    "phonetic": "[əˈfɪʃl]",
    "meaning": "官方的"
  },
  {
    "word": "often",
    "phonetic": "[ˈɒfn]",
    "meaning": "经常"
  },
  {
    "word": "oh",
    "phonetic": "[əʊ]",
    "meaning": "哦"
  },
  {
    "word": "oil",
    "phonetic": "[ɔɪl]",
    "meaning": "油"
  },
  {
    "word": "okay",
    "phonetic": "[ˌəʊˈkeɪ]",
    "meaning": "好的"
  },
  {
    "word": "old",
    "phonetic": "[əʊld]",
    "meaning": "旧的"
  },
  {
    "word": "omit",
    "phonetic": "[əˈmɪt]",
    "meaning": "省略"
  },
  {
    "word": "on",
    "phonetic": "[ɒn]",
    "meaning": "在...上"
  },
  {
    "word": "once",
    "phonetic": "[wʌns]",
    "meaning": "一旦"
  },
  {
    "word": "one",
    "phonetic": "[wʌn]",
    "meaning": "一"
  },
  {
    "word": "oneself",
    "phonetic": "[wʌnˈself]",
    "meaning": "自己"
  },
  {
    "word": "only",
    "phonetic": "[ˈəʊnli]",
    "meaning": "只有"
  },
  {
    "word": "onto",
    "phonetic": "[ˈɒntu]",
    "meaning": "到...上"
  },
  {
    "word": "open",
    "phonetic": "[ˈəʊpən]",
    "meaning": "打开"
  },
  {
    "word": "opening",
    "phonetic": "[ˈəʊpnɪŋ]",
    "meaning": "开始"
  },
  {
    "word": "opera",
    "phonetic": "[ˈɒprə]",
    "meaning": "歌剧"
  },
  {
    "word": "operate",
    "phonetic": "[ˈɒpəreɪt]",
    "meaning": "操作"
  },
  {
    "word": "operation",
    "phonetic": "[ˌɒpəˈreɪʃn]",
    "meaning": "操作"
  },
  {
    "word": "operator",
    "phonetic": "[ˈɒpəreɪtə(r)]",
    "meaning": "操作员"
  },
  {
    "word": "opinion",
    "phonetic": "[əˈpɪnjən]",
    "meaning": "意见"
  },
  {
    "word": "opponent",
    "phonetic": "[əˈpəʊnənt]",
    "meaning": "对手"
  },
  {
    "word": "opportunity",
    "phonetic": "[ˌɒpəˈtjuːnəti]",
    "meaning": "机会"
  },
  {
    "word": "oppose",
    "phonetic": "[əˈpəʊz]",
    "meaning": "反对"
  },
  {
    "word": "opposite",
    "phonetic": "[ˈɒpəzɪt]",
    "meaning": "相反的"
  },
  {
    "word": "oppress",
    "phonetic": "[əˈpres]",
    "meaning": "压迫"
  },
  {
    "word": "optimistic",
    "phonetic": "[ˌɒptɪˈmɪstɪk]",
    "meaning": "乐观的"
  },
  {
    "word": "option",
    "phonetic": "[ˈɒpʃn]",
    "meaning": "选择"
  },
  {
    "word": "optional",
    "phonetic": "[ˈɒpʃənl]",
    "meaning": "可选的"
  },
  {
    "word": "or",
    "phonetic": "[ɔː(r)]",
    "meaning": "或者"
  },
  {
    "word": "oral",
    "phonetic": "[ˈɔːrəl]",
    "meaning": "口头的"
  },
  {
    "word": "orange",
    "phonetic": "[ˈɒrɪndʒ]",
    "meaning": "橙子"
  },
  {
    "word": "orbit",
    "phonetic": "[ˈɔːbɪt]",
    "meaning": "轨道"
  },
  {
    "word": "orchard",
    "phonetic": "[ˈɔːtʃəd]",
    "meaning": "果园"
  },
  {
    "word": "order",
    "phonetic": "[ˈɔːdə(r)]",
    "meaning": "命令"
  },
  {
    "word": "ordinary",
    "phonetic": "[ˈɔːdnri]",
    "meaning": "普通的"
  },
  {
    "word": "organ",
    "phonetic": "[ˈɔːɡən]",
    "meaning": "器官"
  },
  {
    "word": "organic",
    "phonetic": "[ɔːˈɡænɪk]",
    "meaning": "有机的"
  },
  {
    "word": "organize",
    "phonetic": "[ˈɔːɡənaɪz]",
    "meaning": "组织"
  },
  {
    "word": "organization",
    "phonetic": "[ˌɔːɡənaɪˈzeɪʃn]",
    "meaning": "组织"
  },
  {
    "word": "organizer",
    "phonetic": "[ˈɔːɡənaɪzə(r)]",
    "meaning": "组织者"
  },
  {
    "word": "origin",
    "phonetic": "[ˈɒrɪdʒɪn]",
    "meaning": "起源"
  },
  {
    "word": "original",
    "phonetic": "[əˈrɪdʒənl]",
    "meaning": "原始的"
  },
  {
    "word": "originate",
    "phonetic": "[əˈrɪdʒɪneɪt]",
    "meaning": "起源"
  },
  {
    "word": "orphan",
    "phonetic": "[ˈɔːfn]",
    "meaning": "孤儿"
  },
  {
    "word": "other",
    "phonetic": "[ˈʌðə(r)]",
    "meaning": "其他的"
  },
  {
    "word": "otherwise",
    "phonetic": "[ˈʌðəwaɪz]",
    "meaning": "否则"
  },
  {
    "word": "ought",
    "phonetic": "[ɔːt]",
    "meaning": "应该"
  },
  {
    "word": "our",
    "phonetic": "[ˈaʊə(r)]",
    "meaning": "我们的"
  },
  {
    "word": "ours",
    "phonetic": "[ˈaʊəz]",
    "meaning": "我们的"
  },
  {
    "word": "ourselves",
    "phonetic": "[ˌaʊəˈselvz]",
    "meaning": "我们自己"
  },
  {
    "word": "out",
    "phonetic": "[aʊt]",
    "meaning": "出去"
  },
  {
    "word": "outcome",
    "phonetic": "[ˈaʊtkʌm]",
    "meaning": "结果"
  },
  {
    "word": "outer",
    "phonetic": "[ˈaʊtə(r)]",
    "meaning": "外部的"
  },
  {
    "word": "outline",
    "phonetic": "[ˈaʊtlaɪn]",
    "meaning": "轮廓"
  },
  {
    "word": "output",
    "phonetic": "[ˈaʊtpʊt]",
    "meaning": "输出"
  },
  {
    "word": "outside",
    "phonetic": "[ˈaʊtsaɪd]",
    "meaning": "外面"
  },
  {
    "word": "outstanding",
    "phonetic": "[aʊtˈstændɪŋ]",
    "meaning": "杰出的"
  },
  {
    "word": "outward",
    "phonetic": "[ˈaʊtwəd]",
    "meaning": "向外的"
  },
  {
    "word": "oven",
    "phonetic": "[ˈʌvn]",
    "meaning": "烤箱"
  },
  {
    "word": "over",
    "phonetic": "[ˈəʊvə(r)]",
    "meaning": "在...上方"
  },
  {
    "word": "overall",
    "phonetic": "[ˌəʊvərˈɔːl]",
    "meaning": "总体的"
  },
  {
    "word": "overcome",
    "phonetic": "[ˌəʊvəˈkʌm]",
    "meaning": "克服"
  },
  {
    "word": "overhead",
    "phonetic": "[ˌəʊvəˈhed]",
    "meaning": "在头顶上"
  },
  {
    "word": "overlook",
    "phonetic": "[ˌəʊvəˈlʊk]",
    "meaning": "忽视"
  },
  {
    "word": "overnight",
    "phonetic": "[ˌəʊvəˈnaɪt]",
    "meaning": "一夜之间"
  },
  {
    "word": "overseas",
    "phonetic": "[ˌəʊvəˈsiːz]",
    "meaning": "海外的"
  },
  {
    "word": "overtake",
    "phonetic": "[ˌəʊvəˈteɪk]",
    "meaning": "超过"
  },
  {
    "word": "overtime",
    "phonetic": "[ˈəʊvətaɪm]",
    "meaning": "加班"
  },
  {
    "word": "overweight",
    "phonetic": "[ˌəʊvəˈweɪt]",
    "meaning": "超重的"
  },
  {
    "word": "owe",
    "phonetic": "[əʊ]",
    "meaning": "欠"
  },
  {
    "word": "owing",
    "phonetic": "[ˈəʊɪŋ]",
    "meaning": "由于"
  },
  {
    "word": "own",
    "phonetic": "[əʊn]",
    "meaning": "自己的"
  },
  {
    "word": "owner",
    "phonetic": "[ˈəʊnə(r)]",
    "meaning": "所有者"
  },
  {
    "word": "ownership",
    "phonetic": "[ˈəʊnəʃɪp]",
    "meaning": "所有权"
  },
  {
    "word": "ox",
    "phonetic": "[ɒks]",
    "meaning": "牛"
  },
  {
    "word": "oxygen",
    "phonetic": "[ˈɒksɪdʒən]",
    "meaning": "氧气"
  },
  {
    "word": "pace",
    "phonetic": "[peɪs]",
    "meaning": "步伐"
  },
  {
    "word": "pack",
    "phonetic": "[pæk]",
    "meaning": "打包"
  },
  {
    "word": "package",
    "phonetic": "[ˈpækɪdʒ]",
    "meaning": "包裹"
  },
  {
    "word": "packet",
    "phonetic": "[ˈpækɪt]",
    "meaning": "小包"
  },
  {
    "word": "paddle",
    "phonetic": "[ˈpædl]",
    "meaning": "桨"
  },
  {
    "word": "page",
    "phonetic": "[peɪdʒ]",
    "meaning": "页"
  },
  {
    "word": "pain",
    "phonetic": "[peɪn]",
    "meaning": "疼痛"
  },
  {
    "word": "paint",
    "phonetic": "[peɪnt]",
    "meaning": "油漆"
  },
  {
    "word": "painter",
    "phonetic": "[ˈpeɪntə(r)]",
    "meaning": "画家"
  },
  {
    "word": "painting",
    "phonetic": "[ˈpeɪntɪŋ]",
    "meaning": "绘画"
  },
  {
    "word": "pair",
    "phonetic": "[peə(r)]",
    "meaning": "一对"
  },
  {
    "word": "palace",
    "phonetic": "[ˈpæləs]",
    "meaning": "宫殿"
  },
  {
    "word": "pale",
    "phonetic": "[peɪl]",
    "meaning": "苍白的"
  },
  {
    "word": "palm",
    "phonetic": "[pɑːm]",
    "meaning": "手掌"
  },
  {
    "word": "pan",
    "phonetic": "[pæn]",
    "meaning": "平底锅"
  },
  {
    "word": "pancake",
    "phonetic": "[ˈpænkeɪk]",
    "meaning": "煎饼"
  },
  {
    "word": "panda",
    "phonetic": "[ˈpændə]",
    "meaning": "熊猫"
  },
  {
    "word": "panel",
    "phonetic": "[ˈpænl]",
    "meaning": "面板"
  },
  {
    "word": "panic",
    "phonetic": "[ˈpænɪk]",
    "meaning": "恐慌"
  },
  {
    "word": "pants",
    "phonetic": "[pænts]",
    "meaning": "裤子"
  },
  {
    "word": "paper",
    "phonetic": "[ˈpeɪpə(r)]",
    "meaning": "纸"
  },
  {
    "word": "paradise",
    "phonetic": "[ˈpærədaɪs]",
    "meaning": "天堂"
  },
  {
    "word": "paragraph",
    "phonetic": "[ˈpærəɡrɑːf]",
    "meaning": "段落"
  },
  {
    "word": "parallel",
    "phonetic": "[ˈpærəlel]",
    "meaning": "平行的"
  },
  {
    "word": "parcel",
    "phonetic": "[ˈpɑːsl]",
    "meaning": "包裹"
  },
  {
    "word": "pardon",
    "phonetic": "[ˈpɑːdn]",
    "meaning": "原谅"
  },
  {
    "word": "parent",
    "phonetic": "[ˈpeərənt]",
    "meaning": "父母"
  },
  {
    "word": "park",
    "phonetic": "[pɑːk]",
    "meaning": "公园"
  },
  {
    "word": "parking",
    "phonetic": "[ˈpɑːkɪŋ]",
    "meaning": "停车"
  },
  {
    "word": "parliament",
    "phonetic": "[ˈpɑːləmənt]",
    "meaning": "议会"
  },
  {
    "word": "part",
    "phonetic": "[pɑːt]",
    "meaning": "部分"
  },
  {
    "word": "partial",
    "phonetic": "[ˈpɑːʃl]",
    "meaning": "部分的"
  },
  {
    "word": "partially",
    "phonetic": "[ˈpɑːʃəli]",
    "meaning": "部分地"
  },
  {
    "word": "participate",
    "phonetic": "[pɑːˈtɪsɪpeɪt]",
    "meaning": "参与"
  },
  {
    "word": "participation",
    "phonetic": "[pɑːˌtɪsɪˈpeɪʃn]",
    "meaning": "参与"
  },
  {
    "word": "particle",
    "phonetic": "[ˈpɑːtɪkl]",
    "meaning": "粒子"
  },
  {
    "word": "particular",
    "phonetic": "[pəˈtɪkjələ(r)]",
    "meaning": "特别的"
  },
  {
    "word": "particularly",
    "phonetic": "[pəˈtɪkjələli]",
    "meaning": "特别地"
  },
  {
    "word": "partner",
    "phonetic": "[ˈpɑːtnə(r)]",
    "meaning": "伙伴"
  },
  {
    "word": "partnership",
    "phonetic": "[ˈpɑːtnəʃɪp]",
    "meaning": "合作关系"
  },
  {
    "word": "part-time",
    "phonetic": "[ˌpɑːtˈtaɪm]",
    "meaning": "兼职的"
  },
  {
    "word": "party",
    "phonetic": "[ˈpɑːti]",
    "meaning": "聚会"
  },
  {
    "word": "pass",
    "phonetic": "[pɑːs]",
    "meaning": "通过"
  },
  {
    "word": "passage",
    "phonetic": "[ˈpæsɪdʒ]",
    "meaning": "通道"
  },
  {
    "word": "passenger",
    "phonetic": "[ˈpæsɪndʒə(r)]",
    "meaning": "乘客"
  },
  {
    "word": "passer-by",
    "phonetic": "[ˌpɑːsəˈbaɪ]",
    "meaning": "过路人"
  },
  {
    "word": "passion",
    "phonetic": "[ˈpæʃn]",
    "meaning": "激情"
  },
  {
    "word": "passive",
    "phonetic": "[ˈpæsɪv]",
    "meaning": "被动的"
  },
  {
    "word": "passport",
    "phonetic": "[ˈpɑːspɔːt]",
    "meaning": "护照"
  },
  {
    "word": "past",
    "phonetic": "[pɑːst]",
    "meaning": "过去的"
  },
  {
    "word": "paste",
    "phonetic": "[peɪst]",
    "meaning": "浆糊"
  },
  {
    "word": "patience",
    "phonetic": "[ˈpeɪʃns]",
    "meaning": "耐心"
  },
  {
    "word": "patient",
    "phonetic": "[ˈpeɪʃnt]",
    "meaning": "病人"
  },
  {
    "word": "pattern",
    "phonetic": "[ˈpætn]",
    "meaning": "模式"
  },
  {
    "word": "pause",
    "phonetic": "[pɔːz]",
    "meaning": "暂停"
  },
  {
    "word": "pay",
    "phonetic": "[peɪ]",
    "meaning": "支付"
  },
  {
    "word": "payment",
    "phonetic": "[ˈpeɪmənt]",
    "meaning": "支付"
  },
  {
    "word": "pea",
    "phonetic": "[piː]",
    "meaning": "豌豆"
  },
  {
    "word": "peace",
    "phonetic": "[piːs]",
    "meaning": "和平"
  },
  {
    "word": "peaceful",
    "phonetic": "[ˈpiːsfl]",
    "meaning": "和平的"
  },
  {
    "word": "peach",
    "phonetic": "[piːtʃ]",
    "meaning": "桃子"
  },
  {
    "word": "peak",
    "phonetic": "[piːk]",
    "meaning": "山峰"
  },
  {
    "word": "pear",
    "phonetic": "[peə(r)]",
    "meaning": "梨"
  },
  {
    "word": "peasant",
    "phonetic": "[ˈpeznt]",
    "meaning": "农民"
  },
  {
    "word": "peculiar",
    "phonetic": "[pɪˈkjuːliə(r)]",
    "meaning": "特殊的"
  },
  {
    "word": "pedestrian",
    "phonetic": "[pəˈdestriən]",
    "meaning": "行人"
  },
  {
    "word": "peel",
    "phonetic": "[piːl]",
    "meaning": "剥皮"
  },
  {
    "word": "peer",
    "phonetic": "[pɪə(r)]",
    "meaning": "同龄人"
  },
  {
    "word": "pen",
    "phonetic": "[pen]",
    "meaning": "钢笔"
  },
  {
    "word": "pencil",
    "phonetic": "[ˈpensl]",
    "meaning": "铅笔"
  },
  {
    "word": "penetrate",
    "phonetic": "[ˈpenɪtreɪt]",
    "meaning": "渗透"
  },
  {
    "word": "penny",
    "phonetic": "[ˈpeni]",
    "meaning": "便士"
  },
  {
    "word": "pension",
    "phonetic": "[ˈpenʃn]",
    "meaning": "养老金"
  },
  {
    "word": "people",
    "phonetic": "[ˈpiːpl]",
    "meaning": "人们"
  },
  {
    "word": "pepper",
    "phonetic": "[ˈpepə(r)]",
    "meaning": "胡椒"
  },
  {
    "word": "per",
    "phonetic": "[pɜː(r)]",
    "meaning": "每"
  },
  {
    "word": "perceive",
    "phonetic": "[pəˈsiːv]",
    "meaning": "察觉"
  },
  {
    "word": "percent",
    "phonetic": "[pəˈsent]",
    "meaning": "百分比"
  },
  {
    "word": "percentage",
    "phonetic": "[pəˈsentɪdʒ]",
    "meaning": "百分比"
  },
  {
    "word": "perfect",
    "phonetic": "[ˈpɜːfɪkt]",
    "meaning": "完美的"
  },
  {
    "word": "perfectly",
    "phonetic": "[ˈpɜːfɪktli]",
    "meaning": "完美地"
  },
  {
    "word": "performer",
    "phonetic": "[pəˈfɔːmə(r)]",
    "meaning": "表演者"
  },
  {
    "word": "performance",
    "phonetic": "[pəˈfɔːməns]",
    "meaning": "表演"
  },
  {
    "word": "perform",
    "phonetic": "[pəˈfɔːm]",
    "meaning": "执行"
  },
  {
    "word": "perhaps",
    "phonetic": "[pəˈhæps]",
    "meaning": "也许"
  },
  {
    "word": "period",
    "phonetic": "[ˈpɪəriəd]",
    "meaning": "时期"
  },
  {
    "word": "permanent",
    "phonetic": "[ˈpɜːmənənt]",
    "meaning": "永久的"
  },
  {
    "word": "permission",
    "phonetic": "[pəˈmɪʃn]",
    "meaning": "允许"
  },
  {
    "word": "permit",
    "phonetic": "[pəˈmɪt]",
    "meaning": "允许"
  },
  {
    "word": "persist",
    "phonetic": "[pəˈsɪst]",
    "meaning": "坚持"
  },
  {
    "word": "persistent",
    "phonetic": "[pəˈsɪstənt]",
    "meaning": "坚持不懈的"
  },
  {
    "word": "person",
    "phonetic": "[ˈpɜːsn]",
    "meaning": "人"
  },
  {
    "word": "personal",
    "phonetic": "[ˈpɜːsənl]",
    "meaning": "个人的"
  },
  {
    "word": "personally",
    "phonetic": "[ˈpɜːsənəli]",
    "meaning": "亲自"
  },
  {
    "word": "personality",
    "phonetic": "[ˌpɜːsəˈnæləti]",
    "meaning": "个性"
  },
  {
    "word": "personnel",
    "phonetic": "[ˌpɜːsəˈnel]",
    "meaning": "人员"
  },
  {
    "word": "perspective",
    "phonetic": "[pəˈspektɪv]",
    "meaning": "观点"
  },
  {
    "word": "persuade",
    "phonetic": "[pəˈsweɪd]",
    "meaning": "说服"
  },
  {
    "word": "persuasion",
    "phonetic": "[pəˈsweɪʒn]",
    "meaning": "说服"
  },
  {
    "word": "pessimistic",
    "phonetic": "[ˌpesɪˈmɪstɪk]",
    "meaning": "悲观的"
  },
  {
    "word": "pet",
    "phonetic": "[pet]",
    "meaning": "宠物"
  },
  {
    "word": "petrol",
    "phonetic": "[ˈpetrəl]",
    "meaning": "汽油"
  },
  {
    "word": "petroleum",
    "phonetic": "[pəˈtrəʊliəm]",
    "meaning": "石油"
  },
  {
    "word": "phenomenon",
    "phonetic": "[fəˈnɒmɪnən]",
    "meaning": "现象"
  },
  {
    "word": "philosopher",
    "phonetic": "[fəˈlɒsəfə(r)]",
    "meaning": "哲学家"
  },
  {
    "word": "philosophy",
    "phonetic": "[fəˈlɒsəfi]",
    "meaning": "哲学"
  },
  {
    "word": "phone",
    "phonetic": "[fəʊn]",
    "meaning": "电话"
  },
  {
    "word": "photo",
    "phonetic": "[ˈfəʊtəʊ]",
    "meaning": "照片"
  },
  {
    "word": "photograph",
    "phonetic": "[ˈfəʊtəɡrɑːf]",
    "meaning": "照片"
  },
  {
    "word": "photographer",
    "phonetic": "[fəˈtɒɡrəfə(r)]",
    "meaning": "摄影师"
  },
  {
    "word": "photography",
    "phonetic": "[fəˈtɒɡrəfi]",
    "meaning": "摄影"
  },
  {
    "word": "phrase",
    "phonetic": "[freɪz]",
    "meaning": "短语"
  },
  {
    "word": "physical",
    "phonetic": "[ˈfɪzɪkl]",
    "meaning": "身体的"
  },
  {
    "word": "physician",
    "phonetic": "[fəˈzɪʃn]",
    "meaning": "医生"
  },
  {
    "word": "physics",
    "phonetic": "[ˈfɪzɪks]",
    "meaning": "物理"
  },
  {
    "word": "piano",
    "phonetic": "[piˈænəʊ]",
    "meaning": "钢琴"
  },
  {
    "word": "pick",
    "phonetic": "[pɪk]",
    "meaning": "挑选"
  },
  {
    "word": "picnic",
    "phonetic": "[ˈpɪknɪk]",
    "meaning": "野餐"
  },
  {
    "word": "picture",
    "phonetic": "[ˈpɪktʃə(r)]",
    "meaning": "图片"
  },
  {
    "word": "pie",
    "phonetic": "[paɪ]",
    "meaning": "馅饼"
  },
  {
    "word": "piece",
    "phonetic": "[piːs]",
    "meaning": "片"
  },
  {
    "word": "pierce",
    "phonetic": "[pɪəs]",
    "meaning": "刺穿"
  },
  {
    "word": "pig",
    "phonetic": "[pɪɡ]",
    "meaning": "猪"
  },
  {
    "word": "pigeon",
    "phonetic": "[ˈpɪdʒɪn]",
    "meaning": "鸽子"
  },
  {
    "word": "pile",
    "phonetic": "[paɪl]",
    "meaning": "堆"
  },
  {
    "word": "pill",
    "phonetic": "[pɪl]",
    "meaning": "药丸"
  },
  {
    "word": "pillow",
    "phonetic": "[ˈpɪləʊ]",
    "meaning": "枕头"
  },
  {
    "word": "pilot",
    "phonetic": "[ˈpaɪlət]",
    "meaning": "飞行员"
  },
  {
    "word": "pin",
    "phonetic": "[pɪn]",
    "meaning": "别针"
  },
  {
    "word": "pine",
    "phonetic": "[paɪn]",
    "meaning": "松树"
  },
  {
    "word": "pink",
    "phonetic": "[pɪŋk]",
    "meaning": "粉红色"
  },
  {
    "word": "pint",
    "phonetic": "[paɪnt]",
    "meaning": "品脱"
  },
  {
    "word": "pioneer",
    "phonetic": "[ˌpaɪəˈnɪə(r)]",
    "meaning": "先锋"
  },
  {
    "word": "pipe",
    "phonetic": "[paɪp]",
    "meaning": "管道"
  },
  {
    "word": "pity",
    "phonetic": "[ˈpɪti]",
    "meaning": "同情"
  },
  {
    "word": "place",
    "phonetic": "[pleɪs]",
    "meaning": "地方"
  },
  {
    "word": "plain",
    "phonetic": "[pleɪn]",
    "meaning": "平原"
  },
  {
    "word": "plan",
    "phonetic": "[plæn]",
    "meaning": "计划"
  },
  {
    "word": "plane",
    "phonetic": "[pleɪn]",
    "meaning": "飞机"
  },
  {
    "word": "planet",
    "phonetic": "[ˈplænɪt]",
    "meaning": "行星"
  },
  {
    "word": "plant",
    "phonetic": "[plɑːnt]",
    "meaning": "植物"
  },
  {
    "word": "plastic",
    "phonetic": "[ˈplæstɪk]",
    "meaning": "塑料"
  },
  {
    "word": "plate",
    "phonetic": "[pleɪt]",
    "meaning": "盘子"
  },
  {
    "word": "platform",
    "phonetic": "[ˈplætfɔːm]",
    "meaning": "平台"
  },
  {
    "word": "play",
    "phonetic": "[pleɪ]",
    "meaning": "玩"
  },
  {
    "word": "player",
    "phonetic": "[ˈpleɪə(r)]",
    "meaning": "运动员"
  },
  {
    "word": "playground",
    "phonetic": "[ˈpleɪɡraʊnd]",
    "meaning": "操场"
  },
  {
    "word": "pleasant",
    "phonetic": "[ˈpleznt]",
    "meaning": "愉快的"
  },
  {
    "word": "please",
    "phonetic": "[pliːz]",
    "meaning": "请"
  },
  {
    "word": "pleased",
    "phonetic": "[pliːzd]",
    "meaning": "高兴的"
  },
  {
    "word": "pleasing",
    "phonetic": "[ˈpliːzɪŋ]",
    "meaning": "令人愉快的"
  },
  {
    "word": "pleasure",
    "phonetic": "[ˈpleʒə(r)]",
    "meaning": "快乐"
  },
  {
    "word": "plenty",
    "phonetic": "[ˈplenti]",
    "meaning": "大量"
  },
  {
    "word": "plot",
    "phonetic": "[plɒt]",
    "meaning": "情节"
  },
  {
    "word": "plug",
    "phonetic": "[plʌɡ]",
    "meaning": "插头"
  },
  {
    "word": "plus",
    "phonetic": "[plʌs]",
    "meaning": "加"
  },
  {
    "word": "pocket",
    "phonetic": "[ˈpɒkɪt]",
    "meaning": "口袋"
  },
  {
    "word": "poem",
    "phonetic": "[ˈpəʊɪm]",
    "meaning": "诗"
  },
  {
    "word": "poet",
    "phonetic": "[ˈpəʊɪt]",
    "meaning": "诗人"
  },
  {
    "word": "poetry",
    "phonetic": "[ˈpəʊətri]",
    "meaning": "诗歌"
  },
  {
    "word": "point",
    "phonetic": "[pɔɪnt]",
    "meaning": "点"
  },
  {
    "word": "poison",
    "phonetic": "[ˈpɔɪzn]",
    "meaning": "毒药"
  },
  {
    "word": "police",
    "phonetic": "[pəˈliːs]",
    "meaning": "警察"
  },
  {
    "word": "policy",
    "phonetic": "[ˈpɒləsi]",
    "meaning": "政策"
  },
  {
    "word": "polite",
    "phonetic": "[pəˈlaɪt]",
    "meaning": "礼貌的"
  },
  {
    "word": "political",
    "phonetic": "[pəˈlɪtɪkl]",
    "meaning": "政治的"
  },
  {
    "word": "politician",
    "phonetic": "[ˌpɒləˈtɪʃn]",
    "meaning": "政治家"
  },
  {
    "word": "politics",
    "phonetic": "[ˈpɒlətɪks]",
    "meaning": "政治"
  },
  {
    "word": "pollution",
    "phonetic": "[pəˈluːʃn]",
    "meaning": "污染"
  },
  {
    "word": "pond",
    "phonetic": "[pɒnd]",
    "meaning": "池塘"
  },
  {
    "word": "pool",
    "phonetic": "[puːl]",
    "meaning": "游泳池"
  },
  {
    "word": "poor",
    "phonetic": "[pɔː(r)]",
    "meaning": "贫穷的"
  },
  {
    "word": "pop",
    "phonetic": "[pɒp]",
    "meaning": "流行的"
  },
  {
    "word": "popular",
    "phonetic": "[ˈpɒpjələ(r)]",
    "meaning": "受欢迎的"
  },
  {
    "word": "population",
    "phonetic": "[ˌpɒpjuˈleɪʃn]",
    "meaning": "人口"
  },
  {
    "word": "porch",
    "phonetic": "[pɔːtʃ]",
    "meaning": "门廊"
  },
  {
    "word": "pork",
    "phonetic": "[pɔːk]",
    "meaning": "猪肉"
  },
  {
    "word": "port",
    "phonetic": "[pɔːt]",
    "meaning": "港口"
  },
  {
    "word": "portable",
    "phonetic": "[ˈpɔːtəbl]",
    "meaning": "便携的"
  },
  {
    "word": "porter",
    "phonetic": "[ˈpɔːtə(r)]",
    "meaning": "搬运工"
  },
  {
    "word": "portion",
    "phonetic": "[ˈpɔːʃn]",
    "meaning": "部分"
  },
  {
    "word": "portrait",
    "phonetic": "[ˈpɔːtreɪt]",
    "meaning": "肖像"
  },
  {
    "word": "pose",
    "phonetic": "[pəʊz]",
    "meaning": "摆姿势"
  },
  {
    "word": "position",
    "phonetic": "[pəˈzɪʃn]",
    "meaning": "位置"
  },
  {
    "word": "positive",
    "phonetic": "[ˈpɒzətɪv]",
    "meaning": "积极的"
  },
  {
    "word": "possess",
    "phonetic": "[pəˈzes]",
    "meaning": "拥有"
  },
  {
    "word": "possession",
    "phonetic": "[pəˈzeʃn]",
    "meaning": "财产"
  },
  {
    "word": "possibility",
    "phonetic": "[ˌpɒsəˈbɪləti]",
    "meaning": "可能性"
  },
  {
    "word": "possible",
    "phonetic": "[ˈpɒsəbl]",
    "meaning": "可能的"
  },
  {
    "word": "possibly",
    "phonetic": "[ˈpɒsəbli]",
    "meaning": "可能地"
  },
  {
    "word": "post",
    "phonetic": "[pəʊst]",
    "meaning": "职位"
  },
  {
    "word": "postcard",
    "phonetic": "[ˈpəʊstkɑːd]",
    "meaning": "明信片"
  },
  {
    "word": "poster",
    "phonetic": "[ˈpəʊstə(r)]",
    "meaning": "海报"
  },
  {
    "word": "postpone",
    "phonetic": "[pəˈspəʊn]",
    "meaning": "推迟"
  },
  {
    "word": "pot",
    "phonetic": "[pɒt]",
    "meaning": "锅"
  },
  {
    "word": "potato",
    "phonetic": "[pəˈteɪtəʊ]",
    "meaning": "土豆"
  },
  {
    "word": "potential",
    "phonetic": "[pəˈtenʃl]",
    "meaning": "潜在的"
  },
  {
    "word": "pound",
    "phonetic": "[paʊnd]",
    "meaning": "磅"
  },
  {
    "word": "pour",
    "phonetic": "[pɔː(r)]",
    "meaning": "倒"
  },
  {
    "word": "poverty",
    "phonetic": "[ˈpɒvəti]",
    "meaning": "贫困"
  },
  {
    "word": "powder",
    "phonetic": "[ˈpaʊdə(r)]",
    "meaning": "粉末"
  },
  {
    "word": "power",
    "phonetic": "[ˈpaʊə(r)]",
    "meaning": "力量"
  },
  {
    "word": "powerful",
    "phonetic": "[ˈpaʊəfl]",
    "meaning": "强大的"
  },
  {
    "word": "practice",
    "phonetic": "[ˈpræktɪs]",
    "meaning": "练习"
  },
  {
    "word": "praise",
    "phonetic": "[preɪz]",
    "meaning": "赞扬"
  },
  {
    "word": "pray",
    "phonetic": "[preɪ]",
    "meaning": "祈祷"
  },
  {
    "word": "precious",
    "phonetic": "[ˈpreʃəs]",
    "meaning": "珍贵的"
  },
  {
    "word": "precise",
    "phonetic": "[prɪˈsaɪs]",
    "meaning": "精确的"
  },
  {
    "word": "predict",
    "phonetic": "[prɪˈdɪkt]",
    "meaning": "预测"
  },
  {
    "word": "prefer",
    "phonetic": "[prɪˈfɜː(r)]",
    "meaning": "更喜欢"
  },
  {
    "word": "preference",
    "phonetic": "[ˈprefrəns]",
    "meaning": "偏好"
  },
  {
    "word": "prepare",
    "phonetic": "[prɪˈpeə(r)]",
    "meaning": "准备"
  },
  {
    "word": "preparation",
    "phonetic": "[ˌprepəˈreɪʃn]",
    "meaning": "准备"
  },
  {
    "word": "prescription",
    "phonetic": "[prɪˈskrɪpʃn]",
    "meaning": "处方"
  },
  {
    "word": "present",
    "phonetic": "[ˈpreznt]",
    "meaning": "现在的"
  },
  {
    "word": "president",
    "phonetic": "[ˈprezɪdənt]",
    "meaning": "总统"
  },
  {
    "word": "press",
    "phonetic": "[pres]",
    "meaning": "按"
  },
  {
    "word": "pressure",
    "phonetic": "[ˈpreʃə(r)]",
    "meaning": "压力"
  },
  {
    "word": "pretend",
    "phonetic": "[prɪˈtend]",
    "meaning": "假装"
  },
  {
    "word": "pretty",
    "phonetic": "[ˈprɪti]",
    "meaning": "漂亮的"
  },
  {
    "word": "prevent",
    "phonetic": "[prɪˈvent]",
    "meaning": "防止"
  },
  {
    "word": "previous",
    "phonetic": "[ˈpriːviəs]",
    "meaning": "以前的"
  },
  {
    "word": "price",
    "phonetic": "[praɪs]",
    "meaning": "价格"
  },
  {
    "word": "pride",
    "phonetic": "[praɪd]",
    "meaning": "骄傲"
  },
  {
    "word": "primary",
    "phonetic": "[ˈpraɪməri]",
    "meaning": "主要的"
  },
  {
    "word": "prime",
    "phonetic": "[praɪm]",
    "meaning": "主要的"
  },
  {
    "word": "primitive",
    "phonetic": "[ˈprɪmətɪv]",
    "meaning": "原始的"
  },
  {
    "word": "prince",
    "phonetic": "[prɪns]",
    "meaning": "王子"
  },
  {
    "word": "princess",
    "phonetic": "[ˌprɪnˈses]",
    "meaning": "公主"
  },
  {
    "word": "principal",
    "phonetic": "[ˈprɪnsəpl]",
    "meaning": "主要的"
  },
  {
    "word": "principle",
    "phonetic": "[ˈprɪnsəpl]",
    "meaning": "原则"
  },
  {
    "word": "print",
    "phonetic": "[prɪnt]",
    "meaning": "印刷"
  },
  {
    "word": "priority",
    "phonetic": "[praɪˈɒrəti]",
    "meaning": "优先"
  },
  {
    "word": "prison",
    "phonetic": "[ˈprɪzn]",
    "meaning": "监狱"
  },
  {
    "word": "prisoner",
    "phonetic": "[ˈprɪznə(r)]",
    "meaning": "囚犯"
  },
  {
    "word": "private",
    "phonetic": "[ˈpraɪvət]",
    "meaning": "私人的"
  },
  {
    "word": "privilege",
    "phonetic": "[ˈprɪvəlɪdʒ]",
    "meaning": "特权"
  },
  {
    "word": "prize",
    "phonetic": "[praɪz]",
    "meaning": "奖品"
  },
  {
    "word": "probable",
    "phonetic": "[ˈprɒbəbl]",
    "meaning": "很可能的"
  },
  {
    "word": "probably",
    "phonetic": "[ˈprɒbəbli]",
    "meaning": "很可能"
  },
  {
    "word": "problem",
    "phonetic": "[ˈprɒbləm]",
    "meaning": "问题"
  },
  {
    "word": "procedure",
    "phonetic": "[prəˈsiːdʒə(r)]",
    "meaning": "程序"
  },
  {
    "word": "proceed",
    "phonetic": "[prəˈsiːd]",
    "meaning": "继续进行"
  },
  {
    "word": "process",
    "phonetic": "[ˈprəʊses]",
    "meaning": "过程"
  },
  {
    "word": "produce",
    "phonetic": "[prəˈdjuːs]",
    "meaning": "生产"
  },
  {
    "word": "product",
    "phonetic": "[ˈprɒdʌkt]",
    "meaning": "产品"
  },
  {
    "word": "production",
    "phonetic": "[prəˈdʌkʃn]",
    "meaning": "生产"
  },
  {
    "word": "productive",
    "phonetic": "[prəˈdʌktɪv]",
    "meaning": "多产的"
  },
  {
    "word": "productivity",
    "phonetic": "[ˌprɒdʌkˈtɪvəti]",
    "meaning": "生产力"
  },
  {
    "word": "profession",
    "phonetic": "[prəˈfeʃn]",
    "meaning": "职业"
  },
  {
    "word": "professional",
    "phonetic": "[prəˈfeʃənl]",
    "meaning": "专业的"
  },
  {
    "word": "professor",
    "phonetic": "[prəˈfesə(r)]",
    "meaning": "教授"
  },
  {
    "word": "profit",
    "phonetic": "[ˈprɒfɪt]",
    "meaning": "利润"
  },
  {
    "word": "program",
    "phonetic": "[ˈprəʊɡræm]",
    "meaning": "程序"
  },
  {
    "word": "progress",
    "phonetic": "[ˈprəʊɡres]",
    "meaning": "进步"
  },
  {
    "word": "project",
    "phonetic": "[ˈprɒdʒekt]",
    "meaning": "项目"
  },
  {
    "word": "promise",
    "phonetic": "[ˈprɒmɪs]",
    "meaning": "承诺"
  },
  {
    "word": "promote",
    "phonetic": "[prəˈməʊt]",
    "meaning": "促进"
  },
  {
    "word": "prompt",
    "phonetic": "[prɒmpt]",
    "meaning": "迅速的"
  },
  {
    "word": "pronounce",
    "phonetic": "[prəˈnaʊns]",
    "meaning": "发音"
  },
  {
    "word": "pronunciation",
    "phonetic": "[prəˌnʌnsiˈeɪʃn]",
    "meaning": "发音"
  },
  {
    "word": "proof",
    "phonetic": "[pruːf]",
    "meaning": "证明"
  },
  {
    "word": "proper",
    "phonetic": "[ˈprɒpə(r)]",
    "meaning": "适当的"
  },
  {
    "word": "property",
    "phonetic": "[ˈprɒpəti]",
    "meaning": "财产"
  },
  {
    "word": "proposal",
    "phonetic": "[prəˈpəʊzl]",
    "meaning": "提议"
  },
  {
    "word": "propose",
    "phonetic": "[prəˈpəʊz]",
    "meaning": "提议"
  },
  {
    "word": "protect",
    "phonetic": "[prəˈtekt]",
    "meaning": "保护"
  },
  {
    "word": "protection",
    "phonetic": "[prəˈtekʃn]",
    "meaning": "保护"
  },
  {
    "word": "proud",
    "phonetic": "[praʊd]",
    "meaning": "骄傲的"
  },
  {
    "word": "prove",
    "phonetic": "[pruːv]",
    "meaning": "证明"
  },
  {
    "word": "provide",
    "phonetic": "[prəˈvaɪd]",
    "meaning": "提供"
  },
  {
    "word": "provided",
    "phonetic": "[prəˈvaɪdɪd]",
    "meaning": "如果"
  },
  {
    "word": "province",
    "phonetic": "[ˈprɒvɪns]",
    "meaning": "省"
  },
  {
    "word": "proverb",
    "phonetic": "[ˈprɒvɜːb]",
    "meaning": "谚语"
  },
  {
    "word": "psychology",
    "phonetic": "[saɪˈkɒlədʒi]",
    "meaning": "心理学"
  },
  {
    "word": "pub",
    "phonetic": "[pʌb]",
    "meaning": "酒吧"
  },
  {
    "word": "public",
    "phonetic": "[ˈpʌblɪk]",
    "meaning": "公众的"
  },
  {
    "word": "publish",
    "phonetic": "[ˈpʌblɪʃ]",
    "meaning": "出版"
  },
  {
    "word": "pull",
    "phonetic": "[pʊl]",
    "meaning": "拉"
  },
  {
    "word": "pulse",
    "phonetic": "[pʌls]",
    "meaning": "脉搏"
  },
  {
    "word": "pump",
    "phonetic": "[pʌmp]",
    "meaning": "泵"
  },
  {
    "word": "punish",
    "phonetic": "[ˈpʌnɪʃ]",
    "meaning": "惩罚"
  },
  {
    "word": "punishment",
    "phonetic": "[ˈpʌnɪʃmənt]",
    "meaning": "惩罚"
  },
  {
    "word": "pupil",
    "phonetic": "[ˈpjuːpl]",
    "meaning": "学生"
  },
  {
    "word": "purchase",
    "phonetic": "[ˈpɜːtʃəs]",
    "meaning": "购买"
  },
  {
    "word": "pure",
    "phonetic": "[pjʊə(r)]",
    "meaning": "纯净的"
  },
  {
    "word": "purple",
    "phonetic": "[ˈpɜːpl]",
    "meaning": "紫色的"
  },
  {
    "word": "purpose",
    "phonetic": "[ˈpɜːpəs]",
    "meaning": "目的"
  },
  {
    "word": "purse",
    "phonetic": "[pɜːs]",
    "meaning": "钱包"
  },
  {
    "word": "push",
    "phonetic": "[pʊʃ]",
    "meaning": "推"
  },
  {
    "word": "put",
    "phonetic": "[pʊt]",
    "meaning": "放"
  },
  {
    "word": "puzzle",
    "phonetic": "[ˈpʌzl]",
    "meaning": "谜题"
  },
  {
    "word": "qualification",
    "phonetic": "[ˌkwɒlɪfɪˈkeɪʃn]",
    "meaning": "资格"
  },
  {
    "word": "quality",
    "phonetic": "[ˈkwɒləti]",
    "meaning": "质量"
  },
  {
    "word": "quantity",
    "phonetic": "[ˈkwɒntəti]",
    "meaning": "数量"
  },
  {
    "word": "quarter",
    "phonetic": "[ˈkwɔːtə(r)]",
    "meaning": "四分之一"
  },
  {
    "word": "queen",
    "phonetic": "[kwiːn]",
    "meaning": "女王"
  },
  {
    "word": "question",
    "phonetic": "[ˈkwestʃən]",
    "meaning": "问题"
  },
  {
    "word": "queue",
    "phonetic": "[kjuː]",
    "meaning": "队列"
  },
  {
    "word": "quick",
    "phonetic": "[kwɪk]",
    "meaning": "快速的"
  },
  {
    "word": "quiet",
    "phonetic": "[ˈkwaɪət]",
    "meaning": "安静的"
  },
  {
    "word": "quit",
    "phonetic": "[kwɪt]",
    "meaning": "退出"
  },
  {
    "word": "quite",
    "phonetic": "[kwaɪt]",
    "meaning": "相当"
  },
  {
    "word": "quiz",
    "phonetic": "[kwɪz]",
    "meaning": "测验"
  },
  {
    "word": "rabbit",
    "phonetic": "[ˈræbɪt]",
    "meaning": "兔子"
  },
  {
    "word": "race",
    "phonetic": "[reɪs]",
    "meaning": "比赛"
  },
  {
    "word": "radiation",
    "phonetic": "[ˌreɪdiˈeɪʃn]",
    "meaning": "辐射"
  },
  {
    "word": "radio",
    "phonetic": "[ˈreɪdiəʊ]",
    "meaning": "收音机"
  },
  {
    "word": "radium",
    "phonetic": "[ˈreɪdiəm]",
    "meaning": "镭"
  },
  {
    "word": "rag",
    "phonetic": "[ræɡ]",
    "meaning": "破布"
  },
  {
    "word": "rail",
    "phonetic": "[reɪl]",
    "meaning": "铁轨"
  },
  {
    "word": "railway",
    "phonetic": "[ˈreɪlweɪ]",
    "meaning": "铁路"
  },
  {
    "word": "rain",
    "phonetic": "[reɪn]",
    "meaning": "雨"
  },
  {
    "word": "rainbow",
    "phonetic": "[ˈreɪnbəʊ]",
    "meaning": "彩虹"
  },
  {
    "word": "raincoat",
    "phonetic": "[ˈreɪnkəʊt]",
    "meaning": "雨衣"
  },
  {
    "word": "raise",
    "phonetic": "[reɪz]",
    "meaning": "提高"
  },
  {
    "word": "rake",
    "phonetic": "[reɪk]",
    "meaning": "耙子"
  },
  {
    "word": "rapid",
    "phonetic": "[ˈræpɪd]",
    "meaning": "迅速的"
  },
  {
    "word": "rare",
    "phonetic": "[reə(r)]",
    "meaning": "稀有的"
  },
  {
    "word": "rate",
    "phonetic": "[reɪt]",
    "meaning": "比率"
  },
  {
    "word": "rather",
    "phonetic": "[ˈrɑːðə(r)]",
    "meaning": "相当"
  },
  {
    "word": "ratio",
    "phonetic": "[ˈreɪʃiəʊ]",
    "meaning": "比例"
  },
  {
    "word": "raw",
    "phonetic": "[rɔː]",
    "meaning": "生的"
  },
  {
    "word": "ray",
    "phonetic": "[reɪ]",
    "meaning": "光线"
  },
  {
    "word": "razor",
    "phonetic": "[ˈreɪzə(r)]",
    "meaning": "剃须刀"
  },
  {
    "word": "reach",
    "phonetic": "[riːtʃ]",
    "meaning": "到达"
  },
  {
    "word": "react",
    "phonetic": "[riˈækt]",
    "meaning": "反应"
  },
  {
    "word": "reaction",
    "phonetic": "[riˈækʃn]",
    "meaning": "反应"
  },
  {
    "word": "read",
    "phonetic": "[riːd]",
    "meaning": "阅读"
  },
  {
    "word": "reader",
    "phonetic": "[ˈriːdə(r)]",
    "meaning": "读者"
  },
  {
    "word": "reading",
    "phonetic": "[ˈriːdɪŋ]",
    "meaning": "阅读"
  },
  {
    "word": "ready",
    "phonetic": "[ˈredi]",
    "meaning": "准备好的"
  },
  {
    "word": "real",
    "phonetic": "[riːl]",
    "meaning": "真实的"
  },
  {
    "word": "reality",
    "phonetic": "[riˈæləti]",
    "meaning": "现实"
  },
  {
    "word": "realize",
    "phonetic": "[ˈriːəlaɪz]",
    "meaning": "意识到"
  },
  {
    "word": "really",
    "phonetic": "[ˈriːəli]",
    "meaning": "真正地"
  },
  {
    "word": "reason",
    "phonetic": "[ˈriːzn]",
    "meaning": "原因"
  },
  {
    "word": "reasonable",
    "phonetic": "[ˈriːznəbl]",
    "meaning": "合理的"
  },
  {
    "word": "rebel",
    "phonetic": "[ˈrebl]",
    "meaning": "反叛者"
  },
  {
    "word": "recall",
    "phonetic": "[rɪˈkɔːl]",
    "meaning": "回忆"
  },
  {
    "word": "receive",
    "phonetic": "[rɪˈsiːv]",
    "meaning": "收到"
  },
  {
    "word": "recent",
    "phonetic": "[ˈriːsnt]",
    "meaning": "最近的"
  },
  {
    "word": "recently",
    "phonetic": "[ˈriːsntli]",
    "meaning": "最近"
  },
  {
    "word": "recognize",
    "phonetic": "[ˈrekəɡnaɪz]",
    "meaning": "认出"
  },
  {
    "word": "recommend",
    "phonetic": "[ˌrekəˈmend]",
    "meaning": "推荐"
  },
  {
    "word": "record",
    "phonetic": "[ˈrekɔːd]",
    "meaning": "记录"
  },
  {
    "word": "recover",
    "phonetic": "[rɪˈkʌvə(r)]",
    "meaning": "恢复"
  },
  {
    "word": "red",
    "phonetic": "[red]",
    "meaning": "红色的"
  },
  {
    "word": "reduce",
    "phonetic": "[rɪˈdjuːs]",
    "meaning": "减少"
  },
  {
    "word": "reduction",
    "phonetic": "[rɪˈdʌkʃn]",
    "meaning": "减少"
  },
  {
    "word": "refer",
    "phonetic": "[rɪˈfɜː(r)]",
    "meaning": "参考"
  },
  {
    "word": "reference",
    "phonetic": "[ˈrefrəns]",
    "meaning": "参考"
  },
  {
    "word": "reflect",
    "phonetic": "[rɪˈflekt]",
    "meaning": "反射"
  },
  {
    "word": "reflection",
    "phonetic": "[rɪˈflekʃn]",
    "meaning": "反射"
  },
  {
    "word": "refrigerator",
    "phonetic": "[rɪˈfrɪdʒəreɪtə(r)]",
    "meaning": "冰箱"
  },
  {
    "word": "refuse",
    "phonetic": "[rɪˈfjuːz]",
    "meaning": "拒绝"
  },
  {
    "word": "regard",
    "phonetic": "[rɪˈɡɑːd]",
    "meaning": "认为"
  },
  {
    "word": "regardless",
    "phonetic": "[rɪˈɡɑːdləs]",
    "meaning": "不管怎样"
  },
  {
    "word": "region",
    "phonetic": "[ˈriːdʒən]",
    "meaning": "地区"
  },
  {
    "word": "register",
    "phonetic": "[ˈredʒɪstə(r)]",
    "meaning": "登记"
  },
  {
    "word": "regular",
    "phonetic": "[ˈreɡjələ(r)]",
    "meaning": "定期的"
  },
  {
    "word": "regularly",
    "phonetic": "[ˈreɡjələli]",
    "meaning": "定期地"
  },
  {
    "word": "regulation",
    "phonetic": "[ˌreɡjuˈleɪʃn]",
    "meaning": "规则"
  },
  {
    "word": "reinforce",
    "phonetic": "[ˌriːɪnˈfɔːs]",
    "meaning": "加强"
  },
  {
    "word": "reject",
    "phonetic": "[rɪˈdʒekt]",
    "meaning": "拒绝"
  },
  {
    "word": "relate",
    "phonetic": "[rɪˈleɪt]",
    "meaning": "有关"
  },
  {
    "word": "relation",
    "phonetic": "[rɪˈleɪʃn]",
    "meaning": "关系"
  },
  {
    "word": "relationship",
    "phonetic": "[rɪˈleɪʃnʃɪp]",
    "meaning": "关系"
  },
  {
    "word": "relative",
    "phonetic": "[ˈrelətɪv]",
    "meaning": "亲戚"
  },
  {
    "word": "relativity",
    "phonetic": "[ˌreləˈtɪvəti]",
    "meaning": "相对性"
  },
  {
    "word": "relax",
    "phonetic": "[rɪˈlæks]",
    "meaning": "放松"
  },
  {
    "word": "release",
    "phonetic": "[rɪˈliːs]",
    "meaning": "释放"
  },
  {
    "word": "relevant",
    "phonetic": "[ˈreləvənt]",
    "meaning": "相关的"
  },
  {
    "word": "relief",
    "phonetic": "[rɪˈliːf]",
    "meaning": "减轻"
  },
  {
    "word": "religion",
    "phonetic": "[rɪˈlɪdʒən]",
    "meaning": "宗教"
  },
  {
    "word": "religious",
    "phonetic": "[rɪˈlɪdʒəs]",
    "meaning": "宗教的"
  },
  {
    "word": "rely",
    "phonetic": "[rɪˈlaɪ]",
    "meaning": "依靠"
  },
  {
    "word": "remain",
    "phonetic": "[rɪˈmeɪn]",
    "meaning": "保持"
  },
  {
    "word": "remark",
    "phonetic": "[rɪˈmɑːk]",
    "meaning": "评论"
  },
  {
    "word": "remember",
    "phonetic": "[rɪˈmembə(r)]",
    "meaning": "记得"
  },
  {
    "word": "remind",
    "phonetic": "[rɪˈmaɪnd]",
    "meaning": "提醒"
  },
  {
    "word": "remote",
    "phonetic": "[rɪˈməʊt]",
    "meaning": "遥远的"
  },
  {
    "word": "remove",
    "phonetic": "[rɪˈmuːv]",
    "meaning": "移除"
  },
  {
    "word": "renew",
    "phonetic": "[rɪˈnjuː]",
    "meaning": "更新"
  },
  {
    "word": "rent",
    "phonetic": "[rent]",
    "meaning": "租金"
  },
  {
    "word": "repair",
    "phonetic": "[rɪˈpeə(r)]",
    "meaning": "修理"
  },
  {
    "word": "repeat",
    "phonetic": "[rɪˈpiːt]",
    "meaning": "重复"
  },
  {
    "word": "replace",
    "phonetic": "[rɪˈpleɪs]",
    "meaning": "替换"
  },
  {
    "word": "reply",
    "phonetic": "[rɪˈplaɪ]",
    "meaning": "回复"
  },
  {
    "word": "report",
    "phonetic": "[rɪˈpɔːt]",
    "meaning": "报告"
  },
  {
    "word": "reporter",
    "phonetic": "[rɪˈpɔːtə(r)]",
    "meaning": "记者"
  },
  {
    "word": "represent",
    "phonetic": "[ˌreprɪˈzent]",
    "meaning": "代表"
  },
  {
    "word": "representative",
    "phonetic": "[ˌreprɪˈzentətɪv]",
    "meaning": "代表"
  },
  {
    "word": "republic",
    "phonetic": "[rɪˈpʌblɪk]",
    "meaning": "共和国"
  },
  {
    "word": "request",
    "phonetic": "[rɪˈkwest]",
    "meaning": "请求"
  },
  {
    "word": "require",
    "phonetic": "[rɪˈkwaɪə(r)]",
    "meaning": "需要"
  },
  {
    "word": "requirement",
    "phonetic": "[rɪˈkwaɪəmənt]",
    "meaning": "要求"
  },
  {
    "word": "rescue",
    "phonetic": "[ˈreskjuː]",
    "meaning": "救援"
  },
  {
    "word": "research",
    "phonetic": "[rɪˈsɜːtʃ]",
    "meaning": "研究"
  },
  {
    "word": "resemble",
    "phonetic": "[rɪˈzembl]",
    "meaning": "类似"
  },
  {
    "word": "reserve",
    "phonetic": "[rɪˈzɜːv]",
    "meaning": "保留"
  },
  {
    "word": "residence",
    "phonetic": "[ˈrezɪdəns]",
    "meaning": "住宅"
  },
  {
    "word": "resident",
    "phonetic": "[ˈrezɪdənt]",
    "meaning": "居民"
  },
  {
    "word": "resign",
    "phonetic": "[rɪˈzaɪn]",
    "meaning": "辞职"
  },
  {
    "word": "resist",
    "phonetic": "[rɪˈzɪst]",
    "meaning": "抵抗"
  },
  {
    "word": "resistance",
    "phonetic": "[rɪˈzɪstəns]",
    "meaning": "抵抗"
  },
  {
    "word": "resolution",
    "phonetic": "[ˌrezəˈluːʃn]",
    "meaning": "决议"
  },
  {
    "word": "resolve",
    "phonetic": "[rɪˈzɒlv]",
    "meaning": "解决"
  },
  {
    "word": "resort",
    "phonetic": "[rɪˈzɔːt]",
    "meaning": "度假胜地"
  },
  {
    "word": "resource",
    "phonetic": "[rɪˈsɔːs]",
    "meaning": "资源"
  },
  {
    "word": "respect",
    "phonetic": "[rɪˈspekt]",
    "meaning": "尊重"
  },
  {
    "word": "respective",
    "phonetic": "[rɪˈspektɪv]",
    "meaning": "各自的"
  },
  {
    "word": "respond",
    "phonetic": "[rɪˈspɒnd]",
    "meaning": "回应"
  },
  {
    "word": "response",
    "phonetic": "[rɪˈspɒns]",
    "meaning": "回应"
  },
  {
    "word": "responsible",
    "phonetic": "[rɪˈspɒnsəbl]",
    "meaning": "负责的"
  },
  {
    "word": "rest",
    "phonetic": "[rest]",
    "meaning": "休息"
  },
  {
    "word": "restaurant",
    "phonetic": "[ˈrestrɒnt]",
    "meaning": "餐馆"
  },
  {
    "word": "restrict",
    "phonetic": "[rɪˈstrɪkt]",
    "meaning": "限制"
  },
  {
    "word": "result",
    "phonetic": "[rɪˈzʌlt]",
    "meaning": "结果"
  },
  {
    "word": "retell",
    "phonetic": "[riːˈtel]",
    "meaning": "复述"
  },
  {
    "word": "retire",
    "phonetic": "[rɪˈtaɪə(r)]",
    "meaning": "退休"
  },
  {
    "word": "return",
    "phonetic": "[rɪˈtɜːn]",
    "meaning": "返回"
  },
  {
    "word": "reveal",
    "phonetic": "[rɪˈviːl]",
    "meaning": "揭示"
  },
  {
    "word": "review",
    "phonetic": "[rɪˈvjuː]",
    "meaning": "复习"
  },
  {
    "word": "reward",
    "phonetic": "[rɪˈwɔːd]",
    "meaning": "奖励"
  },
  {
    "word": "rewind",
    "phonetic": "[ˌriːˈwaɪnd]",
    "meaning": "倒带"
  },
  {
    "word": "rewrite",
    "phonetic": "[ˌriːˈraɪt]",
    "meaning": "重写"
  },
  {
    "word": "rhetoric",
    "phonetic": "[ˈretərɪk]",
    "meaning": "修辞"
  },
  {
    "word": "rhyme",
    "phonetic": "[raɪm]",
    "meaning": "押韵"
  },
  {
    "word": "rhythm",
    "phonetic": "[ˈrɪðəm]",
    "meaning": "节奏"
  },
  {
    "word": "rice",
    "phonetic": "[raɪs]",
    "meaning": "米饭"
  },
  {
    "word": "rich",
    "phonetic": "[rɪtʃ]",
    "meaning": "富有的"
  },
  {
    "word": "rid",
    "phonetic": "[rɪd]",
    "meaning": "使摆脱"
  },
  {
    "word": "riddle",
    "phonetic": "[ˈrɪdl]",
    "meaning": "谜语"
  },
  {
    "word": "ride",
    "phonetic": "[raɪd]",
    "meaning": "骑"
  },
  {
    "word": "rider",
    "phonetic": "[ˈraɪdə(r)]",
    "meaning": "骑手"
  },
  {
    "word": "ridge",
    "phonetic": "[rɪdʒ]",
    "meaning": "山脊"
  },
  {
    "word": "ridiculous",
    "phonetic": "[rɪˈdɪkjələs]",
    "meaning": "可笑的"
  },
  {
    "word": "rifle",
    "phonetic": "[ˈraɪfl]",
    "meaning": "步枪"
  },
  {
    "word": "right",
    "phonetic": "[raɪt]",
    "meaning": "正确的"
  },
  {
    "word": "ring",
    "phonetic": "[rɪŋ]",
    "meaning": "戒指"
  },
  {
    "word": "riot",
    "phonetic": "[ˈraɪət]",
    "meaning": "暴乱"
  },
  {
    "word": "ripe",
    "phonetic": "[raɪp]",
    "meaning": "成熟的"
  },
  {
    "word": "rise",
    "phonetic": "[raɪz]",
    "meaning": "上升"
  },
  {
    "word": "risk",
    "phonetic": "[rɪsk]",
    "meaning": "风险"
  },
  {
    "word": "rival",
    "phonetic": "[ˈraɪvl]",
    "meaning": "对手"
  },
  {
    "word": "river",
    "phonetic": "[ˈrɪvə(r)]",
    "meaning": "河"
  },
  {
    "word": "road",
    "phonetic": "[rəʊd]",
    "meaning": "道路"
  },
  {
    "word": "roar",
    "phonetic": "[rɔː(r)]",
    "meaning": "咆哮"
  },
  {
    "word": "roast",
    "phonetic": "[rəʊst]",
    "meaning": "烤"
  },
  {
    "word": "robot",
    "phonetic": "[ˈrəʊbɒt]",
    "meaning": "机器人"
  },
  {
    "word": "rock",
    "phonetic": "[rɒk]",
    "meaning": "岩石"
  },
  {
    "word": "rocket",
    "phonetic": "[ˈrɒkɪt]",
    "meaning": "火箭"
  },
  {
    "word": "role",
    "phonetic": "[rəʊl]",
    "meaning": "角色"
  },
  {
    "word": "roll",
    "phonetic": "[rəʊl]",
    "meaning": "滚动"
  },
  {
    "word": "roller",
    "phonetic": "[ˈrəʊlə(r)]",
    "meaning": "滚筒"
  },
  {
    "word": "Roman",
    "phonetic": "[ˈrəʊmən]",
    "meaning": "罗马的"
  },
  {
    "word": "romantic",
    "phonetic": "[rəʊˈmæntɪk]",
    "meaning": "浪漫的"
  },
  {
    "word": "roof",
    "phonetic": "[ruːf]",
    "meaning": "屋顶"
  },
  {
    "word": "room",
    "phonetic": "[ruːm]",
    "meaning": "房间"
  },
  {
    "word": "root",
    "phonetic": "[ruːt]",
    "meaning": "根"
  },
  {
    "word": "rope",
    "phonetic": "[rəʊp]",
    "meaning": "绳子"
  },
  {
    "word": "rose",
    "phonetic": "[rəʊz]",
    "meaning": "玫瑰"
  },
  {
    "word": "rot",
    "phonetic": "[rɒt]",
    "meaning": "腐烂"
  },
  {
    "word": "rotate",
    "phonetic": "[rəʊˈteɪt]",
    "meaning": "旋转"
  },
  {
    "word": "rotten",
    "phonetic": "[ˈrɒtn]",
    "meaning": "腐烂的"
  },
  {
    "word": "rough",
    "phonetic": "[rʌf]",
    "meaning": "粗糙的"
  },
  {
    "word": "round",
    "phonetic": "[raʊnd]",
    "meaning": "圆形的"
  },
  {
    "word": "route",
    "phonetic": "[ruːt]",
    "meaning": "路线"
  },
  {
    "word": "routine",
    "phonetic": "[ruːˈtiːn]",
    "meaning": "例行程序"
  },
  {
    "word": "row",
    "phonetic": "[rəʊ]",
    "meaning": "行"
  },
  {
    "word": "royal",
    "phonetic": "[ˈrɔɪəl]",
    "meaning": "皇家的"
  },
  {
    "word": "rub",
    "phonetic": "[rʌb]",
    "meaning": "摩擦"
  },
  {
    "word": "rubber",
    "phonetic": "[ˈrʌbə(r)]",
    "meaning": "橡胶"
  },
  {
    "word": "rubbish",
    "phonetic": "[ˈrʌbɪʃ]",
    "meaning": "垃圾"
  },
  {
    "word": "rude",
    "phonetic": "[ruːd]",
    "meaning": "粗鲁的"
  },
  {
    "word": "rug",
    "phonetic": "[rʌɡ]",
    "meaning": "地毯"
  },
  {
    "word": "ruin",
    "phonetic": "[ˈruːɪn]",
    "meaning": "毁灭"
  },
  {
    "word": "rule",
    "phonetic": "[ruːl]",
    "meaning": "规则"
  },
  {
    "word": "ruler",
    "phonetic": "[ˈruːlə(r)]",
    "meaning": "尺子"
  },
  {
    "word": "rum",
    "phonetic": "[rʌm]",
    "meaning": "朗姆酒"
  },
  {
    "word": "rumbustious",
    "phonetic": "[rʌmˈbʌstʃəs]",
    "meaning": "喧闹的"
  },
  {
    "word": "rumour",
    "phonetic": "[ˈruːmə(r)]",
    "meaning": "谣言"
  },
  {
    "word": "run",
    "phonetic": "[rʌn]",
    "meaning": "跑"
  },
  {
    "word": "runner",
    "phonetic": "[ˈrʌnə(r)]",
    "meaning": "跑步者"
  },
  {
    "word": "running",
    "phonetic": "[ˈrʌnɪŋ]",
    "meaning": "跑步"
  },
  {
    "word": "rush",
    "phonetic": "[rʌʃ]",
    "meaning": "冲"
  },
  {
    "word": "Russian",
    "phonetic": "[ˈrʌʃn]",
    "meaning": "俄罗斯的"
  },
  {
    "word": "rust",
    "phonetic": "[rʌst]",
    "meaning": "生锈"
  },
  {
    "word": "rusty",
    "phonetic": "[ˈrʌsti]",
    "meaning": "生锈的"
  },
  {
    "word": "sack",
    "phonetic": "[sæk]",
    "meaning": "袋子"
  },
  {
    "word": "sacrifice",
    "phonetic": "[ˈsækrɪfaɪs]",
    "meaning": "牺牲"
  },
  {
    "word": "sad",
    "phonetic": "[sæd]",
    "meaning": "悲伤的"
  },
  {
    "word": "saddle",
    "phonetic": "[ˈsædl]",
    "meaning": "马鞍"
  },
  {
    "word": "safe",
    "phonetic": "[seɪf]",
    "meaning": "安全的"
  },
  {
    "word": "safety",
    "phonetic": "[ˈseɪfti]",
    "meaning": "安全"
  },
  {
    "word": "sail",
    "phonetic": "[seɪl]",
    "meaning": "帆"
  },
  {
    "word": "sailboat",
    "phonetic": "[ˈseɪlbəʊt]",
    "meaning": "帆船"
  },
  {
    "word": "sailor",
    "phonetic": "[ˈseɪlə(r)]",
    "meaning": "水手"
  },
  {
    "word": "saint",
    "phonetic": "[seɪnt]",
    "meaning": "圣人"
  },
  {
    "word": "sake",
    "phonetic": "[seɪk]",
    "meaning": "目的"
  },
  {
    "word": "salad",
    "phonetic": "[ˈsæləd]",
    "meaning": "沙拉"
  },
  {
    "word": "salary",
    "phonetic": "[ˈsæləri]",
    "meaning": "薪水"
  },
  {
    "word": "sale",
    "phonetic": "[seɪl]",
    "meaning": "销售"
  },
  {
    "word": "salesman",
    "phonetic": "[ˈseɪlzmən]",
    "meaning": "售货员"
  },
  {
    "word": "salt",
    "phonetic": "[sɔːlt]",
    "meaning": "盐"
  },
  {
    "word": "salty",
    "phonetic": "[ˈsɔːlti]",
    "meaning": "咸的"
  },
  {
    "word": "salute",
    "phonetic": "[səˈluːt]",
    "meaning": "敬礼"
  },
  {
    "word": "same",
    "phonetic": "[seɪm]",
    "meaning": "相同的"
  },
  {
    "word": "sample",
    "phonetic": "[ˈsɑːmpl]",
    "meaning": "样本"
  },
  {
    "word": "sand",
    "phonetic": "[sænd]",
    "meaning": "沙子"
  },
  {
    "word": "sandwich",
    "phonetic": "[ˈsænwɪtʃ]",
    "meaning": "三明治"
  },
  {
    "word": "satellite",
    "phonetic": "[ˈsætəlaɪt]",
    "meaning": "卫星"
  },
  {
    "word": "satisfaction",
    "phonetic": "[ˌsætɪsˈfækʃn]",
    "meaning": "满意"
  },
  {
    "word": "satisfy",
    "phonetic": "[ˈsætɪsfaɪ]",
    "meaning": "使满意"
  },
  {
    "word": "Saturday",
    "phonetic": "[ˈsætədeɪ]",
    "meaning": "星期六"
  },
  {
    "word": "sauce",
    "phonetic": "[sɔːs]",
    "meaning": "酱"
  },
  {
    "word": "saucer",
    "phonetic": "[ˈsɔːsə(r)]",
    "meaning": "茶托"
  },
  {
    "word": "sausage",
    "phonetic": "[ˈsɒsɪdʒ]",
    "meaning": "香肠"
  },
  {
    "word": "save",
    "phonetic": "[seɪv]",
    "meaning": "保存"
  },
  {
    "word": "saving",
    "phonetic": "[ˈseɪvɪŋ]",
    "meaning": "节约"
  },
  {
    "word": "saw",
    "phonetic": "[sɔː]",
    "meaning": "锯子"
  },
  {
    "word": "say",
    "phonetic": "[seɪ]",
    "meaning": "说"
  },
  {
    "word": "scale",
    "phonetic": "[skeɪl]",
    "meaning": "规模"
  },
  {
    "word": "scan",
    "phonetic": "[skæn]",
    "meaning": "扫描"
  },
  {
    "word": "scandal",
    "phonetic": "[ˈskændl]",
    "meaning": "丑闻"
  },
  {
    "word": "scar",
    "phonetic": "[skɑː(r)]",
    "meaning": "伤疤"
  },
  {
    "word": "scarce",
    "phonetic": "[skeəs]",
    "meaning": "稀少的"
  },
  {
    "word": "scare",
    "phonetic": "[skeə(r)]",
    "meaning": "使害怕"
  },
  {
    "word": "scarf",
    "phonetic": "[skɑːf]",
    "meaning": "围巾"
  },
  {
    "word": "scenery",
    "phonetic": "[ˈsiːnəri]",
    "meaning": "风景"
  },
  {
    "word": "scene",
    "phonetic": "[siːn]",
    "meaning": "场景"
  },
  {
    "word": "schedule",
    "phonetic": "[ˈskedʒuːl]",
    "meaning": "日程表"
  },
  {
    "word": "scheme",
    "phonetic": "[skiːm]",
    "meaning": "计划"
  },
  {
    "word": "scholar",
    "phonetic": "[ˈskɒlə(r)]",
    "meaning": "学者"
  },
  {
    "word": "scholarship",
    "phonetic": "[ˈskɒləʃɪp]",
    "meaning": "奖学金"
  },
  {
    "word": "school",
    "phonetic": "[skuːl]",
    "meaning": "学校"
  },
  {
    "word": "science",
    "phonetic": "[ˈsaɪəns]",
    "meaning": "科学"
  },
  {
    "word": "scientific",
    "phonetic": "[ˌsaɪənˈtɪfɪk]",
    "meaning": "科学的"
  },
  {
    "word": "scientist",
    "phonetic": "[ˈsaɪəntɪst]",
    "meaning": "科学家"
  },
  {
    "word": "scissors",
    "phonetic": "[ˈsɪzəz]",
    "meaning": "剪刀"
  },
  {
    "word": "scold",
    "phonetic": "[skəʊld]",
    "meaning": "责骂"
  },
  {
    "word": "scope",
    "phonetic": "[skəʊp]",
    "meaning": "范围"
  },
  {
    "word": "score",
    "phonetic": "[skɔː(r)]",
    "meaning": "分数"
  },
  {
    "word": "scream",
    "phonetic": "[skriːm]",
    "meaning": "尖叫"
  },
  {
    "word": "screen",
    "phonetic": "[skriːn]",
    "meaning": "屏幕"
  },
  {
    "word": "screw",
    "phonetic": "[skruː]",
    "meaning": "螺丝"
  },
  {
    "word": "script",
    "phonetic": "[skrɪpt]",
    "meaning": "剧本"
  },
  {
    "word": "sculpture",
    "phonetic": "[ˈskʌlptʃə(r)]",
    "meaning": "雕塑"
  },
  {
    "word": "sea",
    "phonetic": "[siː]",
    "meaning": "海"
  },
  {
    "word": "seal",
    "phonetic": "[siːl]",
    "meaning": "海豹"
  },
  {
    "word": "search",
    "phonetic": "[sɜːtʃ]",
    "meaning": "搜索"
  },
  {
    "word": "seaside",
    "phonetic": "[ˈsiːsaɪd]",
    "meaning": "海边"
  },
  {
    "word": "season",
    "phonetic": "[ˈsiːzn]",
    "meaning": "季节"
  },
  {
    "word": "seat",
    "phonetic": "[siːt]",
    "meaning": "座位"
  },
  {
    "word": "seaweed",
    "phonetic": "[ˈsiːwiːd]",
    "meaning": "海草"
  },
  {
    "word": "second",
    "phonetic": "[ˈsekənd]",
    "meaning": "第二"
  },
  {
    "word": "secondary",
    "phonetic": "[ˈsekəndri]",
    "meaning": "次要的"
  },
  {
    "word": "secret",
    "phonetic": "[ˈsiːkrət]",
    "meaning": "秘密"
  },
  {
    "word": "secretary",
    "phonetic": "[ˈsekrətri]",
    "meaning": "秘书"
  },
  {
    "word": "section",
    "phonetic": "[ˈsekʃn]",
    "meaning": "部分"
  },
  {
    "word": "secure",
    "phonetic": "[sɪˈkjʊə(r)]",
    "meaning": "安全的"
  },
  {
    "word": "security",
    "phonetic": "[sɪˈkjʊərəti]",
    "meaning": "安全"
  },
  {
    "word": "see",
    "phonetic": "[siː]",
    "meaning": "看见"
  },
  {
    "word": "seed",
    "phonetic": "[siːd]",
    "meaning": "种子"
  },
  {
    "word": "seek",
    "phonetic": "[siːk]",
    "meaning": "寻找"
  },
  {
    "word": "seem",
    "phonetic": "[siːm]",
    "meaning": "似乎"
  },
  {
    "word": "seize",
    "phonetic": "[siːz]",
    "meaning": "抓住"
  },
  {
    "word": "seldom",
    "phonetic": "[ˈseldəm]",
    "meaning": "很少"
  },
  {
    "word": "select",
    "phonetic": "[sɪˈlekt]",
    "meaning": "选择"
  },
  {
    "word": "selection",
    "phonetic": "[sɪˈlekʃn]",
    "meaning": "选择"
  },
  {
    "word": "self",
    "phonetic": "[self]",
    "meaning": "自己"
  },
  {
    "word": "selfish",
    "phonetic": "[ˈselfɪʃ]",
    "meaning": "自私的"
  },
  {
    "word": "sell",
    "phonetic": "[sel]",
    "meaning": "卖"
  },
  {
    "word": "seller",
    "phonetic": "[ˈselə(r)]",
    "meaning": "卖家"
  },
  {
    "word": "semester",
    "phonetic": "[sɪˈmestə(r)]",
    "meaning": "学期"
  },
  {
    "word": "semiconductor",
    "phonetic": "[ˌsemikənˈdʌktə(r)]",
    "meaning": "半导体"
  },
  {
    "word": "senate",
    "phonetic": "[ˈsenət]",
    "meaning": "参议院"
  },
  {
    "word": "send",
    "phonetic": "[send]",
    "meaning": "发送"
  },
  {
    "word": "senior",
    "phonetic": "[ˈsiːniə(r)]",
    "meaning": "高级的"
  },
  {
    "word": "sense",
    "phonetic": "[sens]",
    "meaning": "感觉"
  },
  {
    "word": "sensible",
    "phonetic": "[ˈsensəbl]",
    "meaning": "明智的"
  },
  {
    "word": "sensitive",
    "phonetic": "[ˈsensətɪv]",
    "meaning": "敏感的"
  },
  {
    "word": "sentence",
    "phonetic": "[ˈsentəns]",
    "meaning": "句子"
  },
  {
    "word": "separate",
    "phonetic": "[ˈsepəreɪt]",
    "meaning": "分开"
  },
  {
    "word": "separation",
    "phonetic": "[ˌsepəˈreɪʃn]",
    "meaning": "分离"
  },
  {
    "word": "September",
    "phonetic": "[sepˈtembə(r)]",
    "meaning": "九月"
  },
  {
    "word": "sequence",
    "phonetic": "[ˈsiːkwəns]",
    "meaning": "顺序"
  },
  {
    "word": "series",
    "phonetic": "[ˈsɪəriːz]",
    "meaning": "系列"
  },
  {
    "word": "serious",
    "phonetic": "[ˈsɪəriəs]",
    "meaning": "严肃的"
  },
  {
    "word": "servant",
    "phonetic": "[ˈsɜːvənt]",
    "meaning": "仆人"
  },
  {
    "word": "serve",
    "phonetic": "[sɜːv]",
    "meaning": "服务"
  },
  {
    "word": "service",
    "phonetic": "[ˈsɜːvɪs]",
    "meaning": "服务"
  },
  {
    "word": "session",
    "phonetic": "[ˈseʃn]",
    "meaning": "会议"
  },
  {
    "word": "set",
    "phonetic": "[set]",
    "meaning": "设置"
  },
  {
    "word": "setting",
    "phonetic": "[ˈsetɪŋ]",
    "meaning": "设置"
  },
  {
    "word": "settle",
    "phonetic": "[ˈsetl]",
    "meaning": "解决"
  },
  {
    "word": "settlement",
    "phonetic": "[ˈsetlmənt]",
    "meaning": "定居点"
  },
  {
    "word": "seven",
    "phonetic": "[ˈsevn]",
    "meaning": "七"
  },
  {
    "word": "seventeen",
    "phonetic": "[ˌsevnˈtiːn]",
    "meaning": "十七"
  },
  {
    "word": "seventh",
    "phonetic": "[ˈsevnθ]",
    "meaning": "第七"
  },
  {
    "word": "seventy",
    "phonetic": "[ˈsevnti]",
    "meaning": "七十"
  },
  {
    "word": "several",
    "phonetic": "[ˈsevrəl]",
    "meaning": "几个"
  },
  {
    "word": "severe",
    "phonetic": "[sɪˈvɪə(r)]",
    "meaning": "严重的"
  },
  {
    "word": "sex",
    "phonetic": "[seks]",
    "meaning": "性别"
  },
  {
    "word": "shade",
    "phonetic": "[ʃeɪd]",
    "meaning": "阴影"
  },
  {
    "word": "shadow",
    "phonetic": "[ˈʃædəʊ]",
    "meaning": "影子"
  },
  {
    "word": "shake",
    "phonetic": "[ʃeɪk]",
    "meaning": "摇晃"
  },
  {
    "word": "shall",
    "phonetic": "[ʃæl]",
    "meaning": "将要"
  },
  {
    "word": "shallow",
    "phonetic": "[ˈʃæləʊ]",
    "meaning": "浅的"
  },
  {
    "word": "shame",
    "phonetic": "[ʃeɪm]",
    "meaning": "羞耻"
  },
  {
    "word": "shape",
    "phonetic": "[ʃeɪp]",
    "meaning": "形状"
  },
  {
    "word": "share",
    "phonetic": "[ʃeə(r)]",
    "meaning": "分享"
  },
  {
    "word": "sharp",
    "phonetic": "[ʃɑːp]",
    "meaning": "锋利的"
  },
  {
    "word": "shave",
    "phonetic": "[ʃeɪv]",
    "meaning": "刮脸"
  },
  {
    "word": "she",
    "phonetic": "[ʃiː]",
    "meaning": "她"
  },
  {
    "word": "sheep",
    "phonetic": "[ʃiːp]",
    "meaning": "羊"
  },
  {
    "word": "sheet",
    "phonetic": "[ʃiːt]",
    "meaning": "床单"
  },
  {
    "word": "shelf",
    "phonetic": "[ʃelf]",
    "meaning": "架子"
  },
  {
    "word": "shell",
    "phonetic": "[ʃel]",
    "meaning": "贝壳"
  },
  {
    "word": "shelter",
    "phonetic": "[ˈʃeltə(r)]",
    "meaning": "庇护所"
  },
  {
    "word": "shield",
    "phonetic": "[ʃiːld]",
    "meaning": "盾牌"
  },
  {
    "word": "shift",
    "phonetic": "[ʃɪft]",
    "meaning": "转移"
  },
  {
    "word": "shine",
    "phonetic": "[ʃaɪn]",
    "meaning": "照耀"
  },
  {
    "word": "ship",
    "phonetic": "[ʃɪp]",
    "meaning": "船"
  },
  {
    "word": "shirt",
    "phonetic": "[ʃɜːt]",
    "meaning": "衬衫"
  },
  {
    "word": "shock",
    "phonetic": "[ʃɒk]",
    "meaning": "震惊"
  },
  {
    "word": "shoe",
    "phonetic": "[ʃuː]",
    "meaning": "鞋子"
  },
  {
    "word": "shoot",
    "phonetic": "[ʃuːt]",
    "meaning": "射击"
  },
  {
    "word": "shop",
    "phonetic": "[ʃɒp]",
    "meaning": "商店"
  },
  {
    "word": "shopping",
    "phonetic": "[ˈʃɒpɪŋ]",
    "meaning": "购物"
  },
  {
    "word": "shore",
    "phonetic": "[ʃɔː(r)]",
    "meaning": "岸"
  },
  {
    "word": "short",
    "phonetic": "[ʃɔːt]",
    "meaning": "短的"
  },
  {
    "word": "shortage",
    "phonetic": "[ˈʃɔːtɪdʒ]",
    "meaning": "短缺"
  },
  {
    "word": "shortcoming",
    "phonetic": "[ˈʃɔːtkʌmɪŋ]",
    "meaning": "缺点"
  },
  {
    "word": "shortly",
    "phonetic": "[ˈʃɔːtli]",
    "meaning": "不久"
  },
  {
    "word": "shot",
    "phonetic": "[ʃɒt]",
    "meaning": "射击"
  },
  {
    "word": "should",
    "phonetic": "[ʃʊd]",
    "meaning": "应该"
  },
  {
    "word": "shoulder",
    "phonetic": "[ˈʃəʊldə(r)]",
    "meaning": "肩膀"
  },
  {
    "word": "shout",
    "phonetic": "[ʃaʊt]",
    "meaning": "喊叫"
  },
  {
    "word": "show",
    "phonetic": "[ʃəʊ]",
    "meaning": "展示"
  },
  {
    "word": "showcase",
    "phonetic": "[ˈʃəʊkeɪs]",
    "meaning": "陈列柜"
  },
  {
    "word": "shown",
    "phonetic": "[ʃəʊn]",
    "meaning": "显示（过去分词）"
  },
  {
    "word": "showroom",
    "phonetic": "[ˈʃəʊruːm]",
    "meaning": "陈列室"
  },
  {
    "word": "shower",
    "phonetic": "[ˈʃaʊə(r)]",
    "meaning": "淋浴"
  },
  {
    "word": "shrink",
    "phonetic": "[ʃrɪŋk]",
    "meaning": "收缩"
  },
  {
    "word": "shrug",
    "phonetic": "[ʃrʌɡ]",
    "meaning": "耸肩"
  },
  {
    "word": "shut",
    "phonetic": "[ʃʌt]",
    "meaning": "关闭"
  },
  {
    "word": "shuttle",
    "phonetic": "[ˈʃʌtl]",
    "meaning": "班车"
  },
  {
    "word": "shy",
    "phonetic": "[ʃaɪ]",
    "meaning": "害羞的"
  },
  {
    "word": "sick",
    "phonetic": "[sɪk]",
    "meaning": "生病的"
  },
  {
    "word": "sickness",
    "phonetic": "[ˈsɪknəs]",
    "meaning": "疾病"
  },
  {
    "word": "side",
    "phonetic": "[saɪd]",
    "meaning": "边"
  },
  {
    "word": "sidewalk",
    "phonetic": "[ˈsaɪdwɔːk]",
    "meaning": "人行道"
  },
  {
    "word": "sigh",
    "phonetic": "[saɪ]",
    "meaning": "叹气"
  },
  {
    "word": "sight",
    "phonetic": "[saɪt]",
    "meaning": "视力"
  },
  {
    "word": "sightseeing",
    "phonetic": "[ˈsaɪtsiːɪŋ]",
    "meaning": "观光"
  },
  {
    "word": "sign",
    "phonetic": "[saɪn]",
    "meaning": "标志"
  },
  {
    "word": "signal",
    "phonetic": "[ˈsɪɡnəl]",
    "meaning": "信号"
  },
  {
    "word": "signature",
    "phonetic": "[ˈsɪɡnətʃə(r)]",
    "meaning": "签名"
  },
  {
    "word": "significance",
    "phonetic": "[sɪɡˈnɪfɪkəns]",
    "meaning": "重要性"
  },
  {
    "word": "significant",
    "phonetic": "[sɪɡˈnɪfɪkənt]",
    "meaning": "重要的"
  },
  {
    "word": "silence",
    "phonetic": "[ˈsaɪləns]",
    "meaning": "沉默"
  },
  {
    "word": "silent",
    "phonetic": "[ˈsaɪlənt]",
    "meaning": "沉默的"
  },
  {
    "word": "silk",
    "phonetic": "[sɪlk]",
    "meaning": "丝绸"
  },
  {
    "word": "silly",
    "phonetic": "[ˈsɪli]",
    "meaning": "愚蠢的"
  },
  {
    "word": "silver",
    "phonetic": "[ˈsɪlvə(r)]",
    "meaning": "银"
  },
  {
    "word": "similar",
    "phonetic": "[ˈsɪmələ(r)]",
    "meaning": "相似的"
  },
  {
    "word": "similarity",
    "phonetic": "[ˌsɪməˈlærəti]",
    "meaning": "相似性"
  },
  {
    "word": "simple",
    "phonetic": "[ˈsɪmpl]",
    "meaning": "简单的"
  },
  {
    "word": "simplify",
    "phonetic": "[ˈsɪmplɪfaɪ]",
    "meaning": "简化"
  },
  {
    "word": "simply",
    "phonetic": "[ˈsɪmpli]",
    "meaning": "简单地"
  },
  {
    "word": "simplicity",
    "phonetic": "[sɪmˈplɪsəti]",
    "meaning": "简单"
  },
  {
    "word": "simulate",
    "phonetic": "[ˈsɪmjuleɪt]",
    "meaning": "模拟"
  },
  {
    "word": "since",
    "phonetic": "[sɪns]",
    "meaning": "自从"
  },
  {
    "word": "sincere",
    "phonetic": "[sɪnˈsɪə(r)]",
    "meaning": "真诚的"
  },
  {
    "word": "sincerity",
    "phonetic": "[sɪnˈserəti]",
    "meaning": "真诚"
  },
  {
    "word": "sing",
    "phonetic": "[sɪŋ]",
    "meaning": "唱歌"
  },
  {
    "word": "single",
    "phonetic": "[ˈsɪŋɡl]",
    "meaning": "单一的"
  },
  {
    "word": "sink",
    "phonetic": "[sɪŋk]",
    "meaning": "下沉"
  },
  {
    "word": "sir",
    "phonetic": "[sɜː(r)]",
    "meaning": "先生"
  },
  {
    "word": "sister",
    "phonetic": "[ˈsɪstə(r)]",
    "meaning": "姐妹"
  },
  {
    "word": "sit",
    "phonetic": "[sɪt]",
    "meaning": "坐"
  },
  {
    "word": "site",
    "phonetic": "[saɪt]",
    "meaning": "地点"
  },
  {
    "word": "situation",
    "phonetic": "[ˌsɪtʃuˈeɪʃn]",
    "meaning": "情况"
  },
  {
    "word": "size",
    "phonetic": "[saɪz]",
    "meaning": "大小"
  },
  {
    "word": "skate",
    "phonetic": "[skeɪt]",
    "meaning": "滑冰"
  },
  {
    "word": "skeleton",
    "phonetic": "[ˈskelɪtn]",
    "meaning": "骨架"
  },
  {
    "word": "sketch",
    "phonetic": "[sketʃ]",
    "meaning": "草图"
  },
  {
    "word": "ski",
    "phonetic": "[skiː]",
    "meaning": "滑雪"
  },
  {
    "word": "skill",
    "phonetic": "[skɪl]",
    "meaning": "技能"
  },
  {
    "word": "skilled",
    "phonetic": "[skɪld]",
    "meaning": "熟练的"
  },
  {
    "word": "skillful",
    "phonetic": "[ˈskɪlfl]",
    "meaning": "熟练的"
  },
  {
    "word": "skin",
    "phonetic": "[skɪn]",
    "meaning": "皮肤"
  },
  {
    "word": "skip",
    "phonetic": "[skɪp]",
    "meaning": "跳过"
  },
  {
    "word": "skirt",
    "phonetic": "[skɜːt]",
    "meaning": "裙子"
  },
  {
    "word": "sky",
    "phonetic": "[skaɪ]",
    "meaning": "天空"
  },
  {
    "word": "slave",
    "phonetic": "[sleɪv]",
    "meaning": "奴隶"
  },
  {
    "word": "sleep",
    "phonetic": "[sliːp]",
    "meaning": "睡觉"
  },
  {
    "word": "sleepy",
    "phonetic": "[ˈsliːpi]",
    "meaning": "困倦的"
  },
  {
    "word": "sleeve",
    "phonetic": "[sliːv]",
    "meaning": "袖子"
  },
  {
    "word": "slender",
    "phonetic": "[ˈslendə(r)]",
    "meaning": "苗条的"
  },
  {
    "word": "slice",
    "phonetic": "[slaɪs]",
    "meaning": "切片"
  },
  {
    "word": "slide",
    "phonetic": "[slaɪd]",
    "meaning": "滑动"
  },
  {
    "word": "slight",
    "phonetic": "[slaɪt]",
    "meaning": "轻微的"
  },
  {
    "word": "slightly",
    "phonetic": "[ˈslaɪtli]",
    "meaning": "稍微"
  },
  {
    "word": "slip",
    "phonetic": "[slɪp]",
    "meaning": "滑倒"
  },
  {
    "word": "slope",
    "phonetic": "[sləʊp]",
    "meaning": "斜坡"
  },
  {
    "word": "slow",
    "phonetic": "[sləʊ]",
    "meaning": "慢的"
  },
  {
    "word": "slowly",
    "phonetic": "[ˈsləʊli]",
    "meaning": "慢慢地"
  },
  {
    "word": "small",
    "phonetic": "[smɔːl]",
    "meaning": "小的"
  },
  {
    "word": "smart",
    "phonetic": "[smɑːt]",
    "meaning": "聪明的"
  },
  {
    "word": "smell",
    "phonetic": "[smel]",
    "meaning": "闻"
  },
  {
    "word": "smile",
    "phonetic": "[smaɪl]",
    "meaning": "微笑"
  },
  {
    "word": "smog",
    "phonetic": "[smɒɡ]",
    "meaning": "烟雾"
  },
  {
    "word": "smoke",
    "phonetic": "[sməʊk]",
    "meaning": "烟"
  },
  {
    "word": "smooth",
    "phonetic": "[smuːð]",
    "meaning": "光滑的"
  },
  {
    "word": "snack",
    "phonetic": "[snæk]",
    "meaning": "小吃"
  },
  {
    "word": "snake",
    "phonetic": "[sneɪk]",
    "meaning": "蛇"
  },
  {
    "word": "snow",
    "phonetic": "[snəʊ]",
    "meaning": "雪"
  },
  {
    "word": "snowball",
    "phonetic": "[ˈsnəʊbɔːl]",
    "meaning": "雪球"
  },
  {
    "word": "snowman",
    "phonetic": "[ˈsnəʊmæn]",
    "meaning": "雪人"
  },
  {
    "word": "so",
    "phonetic": "[səʊ]",
    "meaning": "如此"
  },
  {
    "word": "soap",
    "phonetic": "[səʊp]",
    "meaning": "肥皂"
  },
  {
    "word": "so-called",
    "phonetic": "[ˌsəʊ ˈkɔːld]",
    "meaning": "所谓的"
  },
  {
    "word": "social",
    "phonetic": "[ˈsəʊʃl]",
    "meaning": "社会的"
  },
  {
    "word": "socialist",
    "phonetic": "[ˈsəʊʃəlɪst]",
    "meaning": "社会主义者"
  },
  {
    "word": "society",
    "phonetic": "[səˈsaɪəti]",
    "meaning": "社会"
  },
  {
    "word": "sock",
    "phonetic": "[sɒk]",
    "meaning": "袜子"
  },
  {
    "word": "sofa",
    "phonetic": "[ˈsəʊfə]",
    "meaning": "沙发"
  },
  {
    "word": "soft",
    "phonetic": "[sɒft]",
    "meaning": "柔软的"
  },
  {
    "word": "software",
    "phonetic": "[ˈsɒftweə(r)]",
    "meaning": "软件"
  },
  {
    "word": "soil",
    "phonetic": "[sɔɪl]",
    "meaning": "土壤"
  },
  {
    "word": "solar",
    "phonetic": "[ˈsəʊlə(r)]",
    "meaning": "太阳的"
  },
  {
    "word": "soldier",
    "phonetic": "[ˈsəʊldʒə(r)]",
    "meaning": "士兵"
  },
  {
    "word": "solid",
    "phonetic": "[ˈsɒlɪd]",
    "meaning": "固体"
  },
  {
    "word": "solution",
    "phonetic": "[səˈluːʃn]",
    "meaning": "解决方案"
  },
  {
    "word": "solve",
    "phonetic": "[sɒlv]",
    "meaning": "解决"
  },
  {
    "word": "some",
    "phonetic": "[sʌm]",
    "meaning": "一些"
  },
  {
    "word": "somebody",
    "phonetic": "[ˈsʌmbədi]",
    "meaning": "某人"
  },
  {
    "word": "somehow",
    "phonetic": "[ˈsʌmhaʊ]",
    "meaning": "不知何故"
  },
  {
    "word": "someone",
    "phonetic": "[ˈsʌmwʌn]",
    "meaning": "某人"
  },
  {
    "word": "something",
    "phonetic": "[ˈsʌmθɪŋ]",
    "meaning": "某事"
  },
  {
    "word": "sometimes",
    "phonetic": "[ˈsʌmtaɪmz]",
    "meaning": "有时"
  },
  {
    "word": "somewhere",
    "phonetic": "[ˈsʌmweə(r)]",
    "meaning": "在某处"
  },
  {
    "word": "son",
    "phonetic": "[sʌn]",
    "meaning": "儿子"
  },
  {
    "word": "song",
    "phonetic": "[sɒŋ]",
    "meaning": "歌曲"
  },
  {
    "word": "soon",
    "phonetic": "[suːn]",
    "meaning": "不久"
  },
  {
    "word": "sore",
    "phonetic": "[sɔː(r)]",
    "meaning": "疼痛的"
  },
  {
    "word": "sorrow",
    "phonetic": "[ˈsɒrəʊ]",
    "meaning": "悲伤"
  },
  {
    "word": "sorry",
    "phonetic": "[ˈsɒri]",
    "meaning": "抱歉的"
  },
  {
    "word": "sort",
    "phonetic": "[sɔːt]",
    "meaning": "种类"
  },
  {
    "word": "soul",
    "phonetic": "[səʊl]",
    "meaning": "灵魂"
  },
  {
    "word": "sound",
    "phonetic": "[saʊnd]",
    "meaning": "声音"
  },
  {
    "word": "soup",
    "phonetic": "[suːp]",
    "meaning": "汤"
  },
  {
    "word": "source",
    "phonetic": "[sɔːs]",
    "meaning": "来源"
  },
  {
    "word": "south",
    "phonetic": "[saʊθ]",
    "meaning": "南方"
  },
  {
    "word": "southern",
    "phonetic": "[ˈsʌðən]",
    "meaning": "南方的"
  },
  {
    "word": "southwest",
    "phonetic": "[ˌsaʊθˈwest]",
    "meaning": "西南"
  },
  {
    "word": "sow",
    "phonetic": "[səʊ]",
    "meaning": "播种"
  },
  {
    "word": "space",
    "phonetic": "[speɪs]",
    "meaning": "空间"
  },
  {
    "word": "spaceship",
    "phonetic": "[ˈspeɪsʃɪp]",
    "meaning": "宇宙飞船"
  },
  {
    "word": "spare",
    "phonetic": "[speə(r)]",
    "meaning": "备用的"
  },
  {
    "word": "sparrow",
    "phonetic": "[ˈspærəʊ]",
    "meaning": "麻雀"
  },
  {
    "word": "speak",
    "phonetic": "[spiːk]",
    "meaning": "说话"
  },
  {
    "word": "speaker",
    "phonetic": "[ˈspiːkə(r)]",
    "meaning": "演讲者"
  },
  {
    "word": "spear",
    "phonetic": "[spɪə(r)]",
    "meaning": "矛"
  },
  {
    "word": "special",
    "phonetic": "[ˈspeʃl]",
    "meaning": "特别的"
  },
  {
    "word": "specialist",
    "phonetic": "[ˈspeʃəlɪst]",
    "meaning": "专家"
  },
  {
    "word": "specialize",
    "phonetic": "[ˈspeʃəlaɪz]",
    "meaning": "专门研究"
  },
  {
    "word": "specific",
    "phonetic": "[spəˈsɪfɪk]",
    "meaning": "特定的"
  },
  {
    "word": "specifically",
    "phonetic": "[spəˈsɪfɪkli]",
    "meaning": "具体地"
  },
  {
    "word": "specify",
    "phonetic": "[ˈspesɪfaɪ]",
    "meaning": "指定"
  },
  {
    "word": "speech",
    "phonetic": "[spiːtʃ]",
    "meaning": "演讲"
  },
  {
    "word": "speed",
    "phonetic": "[spiːd]",
    "meaning": "速度"
  },
  {
    "word": "spell",
    "phonetic": "[spel]",
    "meaning": "拼写"
  },
  {
    "word": "spelling",
    "phonetic": "[ˈspelɪŋ]",
    "meaning": "拼写"
  },
  {
    "word": "spend",
    "phonetic": "[spend]",
    "meaning": "花费"
  },
  {
    "word": "sphere",
    "phonetic": "[sfɪə(r)]",
    "meaning": "球体"
  },
  {
    "word": "spider",
    "phonetic": "[ˈspaɪdə(r)]",
    "meaning": "蜘蛛"
  },
  {
    "word": "spin",
    "phonetic": "[spɪn]",
    "meaning": "旋转"
  },
  {
    "word": "spirit",
    "phonetic": "[ˈspɪrɪt]",
    "meaning": "精神"
  },
  {
    "word": "spit",
    "phonetic": "[spɪt]",
    "meaning": "吐"
  },
  {
    "word": "split",
    "phonetic": "[splɪt]",
    "meaning": "分裂"
  },
  {
    "word": "spoken",
    "phonetic": "[ˈspəʊkən]",
    "meaning": "口语的"
  },
  {
    "word": "spokesman",
    "phonetic": "[ˈspəʊksmən]",
    "meaning": "发言人"
  },
  {
    "word": "sponge",
    "phonetic": "[spʌndʒ]",
    "meaning": "海绵"
  },
  {
    "word": "spoon",
    "phonetic": "[spuːn]",
    "meaning": "勺子"
  },
  {
    "word": "sport",
    "phonetic": "[spɔːt]",
    "meaning": "运动"
  },
  {
    "word": "sportsman",
    "phonetic": "[ˈspɔːtsmən]",
    "meaning": "运动员"
  },
  {
    "word": "spot",
    "phonetic": "[spɒt]",
    "meaning": "地点"
  },
  {
    "word": "spread",
    "phonetic": "[spred]",
    "meaning": "传播"
  },
  {
    "word": "spring",
    "phonetic": "[sprɪŋ]",
    "meaning": "春天"
  },
  {
    "word": "spy",
    "phonetic": "[spaɪ]",
    "meaning": "间谍"
  },
  {
    "word": "square",
    "phonetic": "[skweə(r)]",
    "meaning": "正方形"
  },
  {
    "word": "squeeze",
    "phonetic": "[skwiːz]",
    "meaning": "挤"
  },
  {
    "word": "stable",
    "phonetic": "[ˈsteɪbl]",
    "meaning": "稳定的"
  },
  {
    "word": "stadium",
    "phonetic": "[ˈsteɪdiəm]",
    "meaning": "体育场"
  },
  {
    "word": "staff",
    "phonetic": "[stɑːf]",
    "meaning": "员工"
  },
  {
    "word": "stage",
    "phonetic": "[steɪdʒ]",
    "meaning": "舞台"
  },
  {
    "word": "stain",
    "phonetic": "[steɪn]",
    "meaning": "污点"
  },
  {
    "word": "stair",
    "phonetic": "[steə(r)]",
    "meaning": "楼梯"
  },
  {
    "word": "staircase",
    "phonetic": "[ˈsteəkeɪs]",
    "meaning": "楼梯"
  },
  {
    "word": "stamp",
    "phonetic": "[stæmp]",
    "meaning": "邮票"
  },
  {
    "word": "stand",
    "phonetic": "[stænd]",
    "meaning": "站立"
  },
  {
    "word": "standard",
    "phonetic": "[ˈstændəd]",
    "meaning": "标准"
  },
  {
    "word": "staple",
    "phonetic": "[ˈsteɪpl]",
    "meaning": "主要产品"
  },
  {
    "word": "star",
    "phonetic": "[stɑː(r)]",
    "meaning": "星星"
  },
  {
    "word": "stare",
    "phonetic": "[steə(r)]",
    "meaning": "盯着看"
  },
  {
    "word": "start",
    "phonetic": "[stɑːt]",
    "meaning": "开始"
  },
  {
    "word": "starve",
    "phonetic": "[stɑːv]",
    "meaning": "挨饿"
  },
  {
    "word": "state",
    "phonetic": "[steɪt]",
    "meaning": "状态"
  },
  {
    "word": "statement",
    "phonetic": "[ˈsteɪtmənt]",
    "meaning": "声明"
  },
  {
    "word": "statesman",
    "phonetic": "[ˈsteɪtsmən]",
    "meaning": "政治家"
  },
  {
    "word": "station",
    "phonetic": "[ˈsteɪʃn]",
    "meaning": "车站"
  },
  {
    "word": "stationery",
    "phonetic": "[ˈsteɪʃənri]",
    "meaning": "文具"
  },
  {
    "word": "statue",
    "phonetic": "[ˈstætʃuː]",
    "meaning": "雕像"
  },
  {
    "word": "status",
    "phonetic": "[ˈsteɪtəs]",
    "meaning": "地位"
  },
  {
    "word": "stay",
    "phonetic": "[steɪ]",
    "meaning": "停留"
  },
  {
    "word": "steady",
    "phonetic": "[ˈstedi]",
    "meaning": "稳定的"
  },
  {
    "word": "steal",
    "phonetic": "[stiːl]",
    "meaning": "偷"
  },
  {
    "word": "steam",
    "phonetic": "[stiːm]",
    "meaning": "蒸汽"
  },
  {
    "word": "steel",
    "phonetic": "[stiːl]",
    "meaning": "钢"
  },
  {
    "word": "steep",
    "phonetic": "[stiːp]",
    "meaning": "陡峭的"
  },
  {
    "word": "steer",
    "phonetic": "[stɪə(r)]",
    "meaning": "驾驶"
  },
  {
    "word": "stem",
    "phonetic": "[stem]",
    "meaning": "茎"
  },
  {
    "word": "step",
    "phonetic": "[step]",
    "meaning": "步骤"
  },
  {
    "word": "stepmother",
    "phonetic": "[ˈstepmʌðə(r)]",
    "meaning": "继母"
  },
  {
    "word": "stewardess",
    "phonetic": "[ˈstjuːədes]",
    "meaning": "空姐"
  },
  {
    "word": "stick",
    "phonetic": "[stɪk]",
    "meaning": "棍"
  },
  {
    "word": "stiff",
    "phonetic": "[stɪf]",
    "meaning": "僵硬的"
  },
  {
    "word": "still",
    "phonetic": "[stɪl]",
    "meaning": "仍然"
  },
  {
    "word": "stimulate",
    "phonetic": "[ˈstɪmjuleɪt]",
    "meaning": "刺激"
  },
  {
    "word": "sting",
    "phonetic": "[stɪŋ]",
    "meaning": "刺"
  },
  {
    "word": "stir",
    "phonetic": "[stɜː(r)]",
    "meaning": "搅拌"
  },
  {
    "word": "stitch",
    "phonetic": "[stɪtʃ]",
    "meaning": "缝"
  },
  {
    "word": "stock",
    "phonetic": "[stɒk]",
    "meaning": "股票"
  },
  {
    "word": "stomach",
    "phonetic": "[ˈstʌmək]",
    "meaning": "胃"
  },
  {
    "word": "stone",
    "phonetic": "[stəʊn]",
    "meaning": "石头"
  },
  {
    "word": "stop",
    "phonetic": "[stɒp]",
    "meaning": "停止"
  },
  {
    "word": "storage",
    "phonetic": "[ˈstɔːrɪdʒ]",
    "meaning": "存储"
  },
  {
    "word": "store",
    "phonetic": "[stɔː(r)]",
    "meaning": "商店"
  },
  {
    "word": "storm",
    "phonetic": "[stɔːm]",
    "meaning": "风暴"
  },
  {
    "word": "story",
    "phonetic": "[ˈstɔːri]",
    "meaning": "故事"
  },
  {
    "word": "stove",
    "phonetic": "[stəʊv]",
    "meaning": "炉"
  },
  {
    "word": "straight",
    "phonetic": "[streɪt]",
    "meaning": "直的"
  },
  {
    "word": "straightforward",
    "phonetic": "[ˌstreɪtˈfɔːwəd]",
    "meaning": "直接的"
  },
  {
    "word": "strain",
    "phonetic": "[streɪn]",
    "meaning": "压力"
  },
  {
    "word": "strange",
    "phonetic": "[streɪndʒ]",
    "meaning": "奇怪的"
  },
  {
    "word": "stranger",
    "phonetic": "[ˈstreɪndʒə(r)]",
    "meaning": "陌生人"
  },
  {
    "word": "straw",
    "phonetic": "[strɔː]",
    "meaning": "稻草"
  },
  {
    "word": "strawberry",
    "phonetic": "[ˈstrɔːbəri]",
    "meaning": "草莓"
  },
  {
    "word": "stream",
    "phonetic": "[striːm]",
    "meaning": "溪流"
  },
  {
    "word": "street",
    "phonetic": "[striːt]",
    "meaning": "街道"
  },
  {
    "word": "strength",
    "phonetic": "[streŋθ]",
    "meaning": "力量"
  },
  {
    "word": "strengthen",
    "phonetic": "[ˈstreŋθn]",
    "meaning": "加强"
  },
  {
    "word": "stress",
    "phonetic": "[stres]",
    "meaning": "压力"
  },
  {
    "word": "stretch",
    "phonetic": "[stretʃ]",
    "meaning": "伸展"
  },
  {
    "word": "strict",
    "phonetic": "[strɪkt]",
    "meaning": "严格的"
  },
  {
    "word": "strictly",
    "phonetic": "[ˈstrɪktli]",
    "meaning": "严格地"
  },
  {
    "word": "stride",
    "phonetic": "[straɪd]",
    "meaning": "大步走"
  },
  {
    "word": "strike",
    "phonetic": "[straɪk]",
    "meaning": "罢工"
  },
  {
    "word": "string",
    "phonetic": "[strɪŋ]",
    "meaning": "线"
  },
  {
    "word": "strip",
    "phonetic": "[strɪp]",
    "meaning": "条"
  },
  {
    "word": "stripe",
    "phonetic": "[straɪp]",
    "meaning": "条纹"
  },
  {
    "word": "stroke",
    "phonetic": "[strəʊk]",
    "meaning": "中风"
  },
  {
    "word": "strong",
    "phonetic": "[strɒŋ]",
    "meaning": "强壮的"
  },
  {
    "word": "strongly",
    "phonetic": "[ˈstrɒŋli]",
    "meaning": "强烈地"
  },
  {
    "word": "structure",
    "phonetic": "[ˈstrʌktʃə(r)]",
    "meaning": "结构"
  },
  {
    "word": "struggle",
    "phonetic": "[ˈstrʌɡl]",
    "meaning": "挣扎"
  },
  {
    "word": "student",
    "phonetic": "[ˈstjuːdənt]",
    "meaning": "学生"
  },
  {
    "word": "studio",
    "phonetic": "[ˈstjuːdiəʊ]",
    "meaning": "工作室"
  },
  {
    "word": "study",
    "phonetic": "[ˈstʌdi]",
    "meaning": "学习"
  },
  {
    "word": "stuff",
    "phonetic": "[stʌf]",
    "meaning": "东西"
  },
  {
    "word": "stupid",
    "phonetic": "[ˈstjuːpɪd]",
    "meaning": "愚蠢的"
  },
  {
    "word": "style",
    "phonetic": "[staɪl]",
    "meaning": "风格"
  },
  {
    "word": "subject",
    "phonetic": "[ˈsʌbdʒɪkt]",
    "meaning": "学科"
  },
  {
    "word": "submit",
    "phonetic": "[səbˈmɪt]",
    "meaning": "提交"
  },
  {
    "word": "substance",
    "phonetic": "[ˈsʌbstəns]",
    "meaning": "物质"
  },
  {
    "word": "substitute",
    "phonetic": "[ˈsʌbstɪtjuːt]",
    "meaning": "替代品"
  },
  {
    "word": "subtract",
    "phonetic": "[səbˈtrækt]",
    "meaning": "减去"
  },
  {
    "word": "suburb",
    "phonetic": "[ˈsʌbɜːb]",
    "meaning": "郊区"
  },
  {
    "word": "succeed",
    "phonetic": "[səkˈsiːd]",
    "meaning": "成功"
  },
  {
    "word": "success",
    "phonetic": "[səkˈses]",
    "meaning": "成功"
  },
  {
    "word": "successful",
    "phonetic": "[səkˈsesfl]",
    "meaning": "成功的"
  },
  {
    "word": "successfully",
    "phonetic": "[səkˈsesfəli]",
    "meaning": "成功地"
  },
  {
    "word": "such",
    "phonetic": "[sʌtʃ]",
    "meaning": "这样的"
  },
  {
    "word": "sudden",
    "phonetic": "[ˈsʌdn]",
    "meaning": "突然的"
  },
  {
    "word": "suddenly",
    "phonetic": "[ˈsʌdənli]",
    "meaning": "突然地"
  },
  {
    "word": "suffer",
    "phonetic": "[ˈsʌfə(r)]",
    "meaning": "遭受"
  },
  {
    "word": "suffering",
    "phonetic": "[ˈsʌfərɪŋ]",
    "meaning": "痛苦"
  },
  {
    "word": "sufficient",
    "phonetic": "[səˈfɪʃnt]",
    "meaning": "足够的"
  },
  {
    "word": "sugar",
    "phonetic": "[ˈʃʊɡə(r)]",
    "meaning": "糖"
  },
  {
    "word": "suggest",
    "phonetic": "[səˈdʒest]",
    "meaning": "建议"
  },
  {
    "word": "suggestion",
    "phonetic": "[səˈdʒestʃən]",
    "meaning": "建议"
  },
  {
    "word": "suit",
    "phonetic": "[suːt]",
    "meaning": "适合"
  },
  {
    "word": "suitable",
    "phonetic": "[ˈsuːtəbl]",
    "meaning": "合适的"
  },
  {
    "word": "suite",
    "phonetic": "[swiːt]",
    "meaning": "套房"
  },
  {
    "word": "summary",
    "phonetic": "[ˈsʌməri]",
    "meaning": "总结"
  },
  {
    "word": "summer",
    "phonetic": "[ˈsʌmə(r)]",
    "meaning": "夏天"
  },
  {
    "word": "sun",
    "phonetic": "[sʌn]",
    "meaning": "太阳"
  },
  {
    "word": "Sunday",
    "phonetic": "[ˈsʌndeɪ]",
    "meaning": "星期日"
  },
  {
    "word": "sunlight",
    "phonetic": "[ˈsʌnlaɪt]",
    "meaning": "阳光"
  },
  {
    "word": "sunny",
    "phonetic": "[ˈsʌni]",
    "meaning": "晴朗的"
  },
  {
    "word": "sunrise",
    "phonetic": "[ˈsʌnraɪz]",
    "meaning": "日出"
  },
  {
    "word": "sunset",
    "phonetic": "[ˈsʌnset]",
    "meaning": "日落"
  },
  {
    "word": "sunshine",
    "phonetic": "[ˈsʌnʃaɪn]",
    "meaning": "阳光"
  },
  {
    "word": "super",
    "phonetic": "[ˈsuːpə(r)]",
    "meaning": "超级的"
  },
  {
    "word": "superior",
    "phonetic": "[suːˈpɪəriə(r)]",
    "meaning": "优越的"
  },
  {
    "word": "supermarket",
    "phonetic": "[ˈsuːpəmɑːkɪt]",
    "meaning": "超市"
  },
  {
    "word": "supper",
    "phonetic": "[ˈsʌpə(r)]",
    "meaning": "晚餐"
  },
  {
    "word": "supply",
    "phonetic": "[səˈplaɪ]",
    "meaning": "供应"
  },
  {
    "word": "support",
    "phonetic": "[səˈpɔːt]",
    "meaning": "支持"
  },
  {
    "word": "suppose",
    "phonetic": "[səˈpəʊz]",
    "meaning": "假设"
  },
  {
    "word": "sure",
    "phonetic": "[ʃʊə(r)]",
    "meaning": "确定的"
  },
  {
    "word": "surely",
    "phonetic": "[ˈʃʊəli]",
    "meaning": "当然"
  },
  {
    "word": "surface",
    "phonetic": "[ˈsɜːfɪs]",
    "meaning": "表面"
  },
  {
    "word": "surgeon",
    "phonetic": "[ˈsɜːdʒən]",
    "meaning": "外科医生"
  },
  {
    "word": "surgery",
    "phonetic": "[ˈsɜːdʒəri]",
    "meaning": "外科手术"
  },
  {
    "word": "surprise",
    "phonetic": "[səˈpraɪz]",
    "meaning": "惊喜"
  },
  {
    "word": "surprising",
    "phonetic": "[səˈpraɪzɪŋ]",
    "meaning": "令人惊讶的"
  },
  {
    "word": "surprisingly",
    "phonetic": "[səˈpraɪzɪŋli]",
    "meaning": "令人惊讶地"
  },
  {
    "word": "surround",
    "phonetic": "[səˈraʊnd]",
    "meaning": "包围"
  },
  {
    "word": "surroundings",
    "phonetic": "[səˈraʊndɪŋz]",
    "meaning": "环境"
  },
  {
    "word": "survey",
    "phonetic": "[ˈsɜːveɪ]",
    "meaning": "调查"
  },
  {
    "word": "survive",
    "phonetic": "[səˈvaɪv]",
    "meaning": "幸存"
  },
  {
    "word": "survival",
    "phonetic": "[səˈvaɪvl]",
    "meaning": "生存"
  },
  {
    "word": "survivor",
    "phonetic": "[səˈvaɪvə(r)]",
    "meaning": "幸存者"
  },
  {
    "word": "suspect",
    "phonetic": "[səˈspekt]",
    "meaning": "怀疑"
  },
  {
    "word": "suspicion",
    "phonetic": "[səˈspɪʃn]",
    "meaning": "怀疑"
  },
  {
    "word": "sustain",
    "phonetic": "[səˈsteɪn]",
    "meaning": "维持"
  },
  {
    "word": "swallow",
    "phonetic": "[ˈswɒləʊ]",
    "meaning": "吞咽"
  },
  {
    "word": "swam",
    "phonetic": "[swæm]",
    "meaning": "游泳（过去式）"
  },
  {
    "word": "swamp",
    "phonetic": "[swɒmp]",
    "meaning": "沼泽"
  },
  {
    "word": "swan",
    "phonetic": "[swɒn]",
    "meaning": "天鹅"
  },
  {
    "word": "swap",
    "phonetic": "[swɒp]",
    "meaning": "交换"
  },
  {
    "word": "sweep",
    "phonetic": "[swiːp]",
    "meaning": "打扫"
  },
  {
    "word": "sweet",
    "phonetic": "[swiːt]",
    "meaning": "甜的"
  },
  {
    "word": "sweetheart",
    "phonetic": "[ˈswiːthɑːt]",
    "meaning": "甜心"
  },
  {
    "word": "swell",
    "phonetic": "[swel]",
    "meaning": "肿胀"
  },
  {
    "word": "swim",
    "phonetic": "[swɪm]",
    "meaning": "游泳"
  },
  {
    "word": "swimming",
    "phonetic": "[ˈswɪmɪŋ]",
    "meaning": "游泳"
  },
  {
    "word": "swing",
    "phonetic": "[swɪŋ]",
    "meaning": "摇摆"
  },
  {
    "word": "switch",
    "phonetic": "[swɪtʃ]",
    "meaning": "开关"
  },
  {
    "word": "sword",
    "phonetic": "[sɔːd]",
    "meaning": "剑"
  },
  {
    "word": "symbol",
    "phonetic": "[ˈsɪmbl]",
    "meaning": "象征"
  },
  {
    "word": "sympathy",
    "phonetic": "[ˈsɪmpəθi]",
    "meaning": "同情"
  },
  {
    "word": "symptom",
    "phonetic": "[ˈsɪmptəm]",
    "meaning": "症状"
  },
  {
    "word": "system",
    "phonetic": "[ˈsɪstəm]",
    "meaning": "系统"
  },
  {
    "word": "table",
    "phonetic": "[ˈteɪbl]",
    "meaning": "桌子"
  },
  {
    "word": "tablet",
    "phonetic": "[ˈtæblət]",
    "meaning": "药片"
  },
  {
    "word": "tail",
    "phonetic": "[teɪl]",
    "meaning": "尾巴"
  },
  {
    "word": "take",
    "phonetic": "[teɪk]",
    "meaning": "拿"
  },
  {
    "word": "talent",
    "phonetic": "[ˈtælənt]",
    "meaning": "天赋"
  },
  {
    "word": "talk",
    "phonetic": "[tɔːk]",
    "meaning": "谈话"
  },
  {
    "word": "tall",
    "phonetic": "[tɔːl]",
    "meaning": "高的"
  },
  {
    "word": "tank",
    "phonetic": "[tæŋk]",
    "meaning": "坦克"
  },
  {
    "word": "tap",
    "phonetic": "[tæp]",
    "meaning": "水龙头"
  },
  {
    "word": "tape",
    "phonetic": "[teɪp]",
    "meaning": "胶带"
  },
  {
    "word": "target",
    "phonetic": "[ˈtɑːɡɪt]",
    "meaning": "目标"
  },
  {
    "word": "task",
    "phonetic": "[tɑːsk]",
    "meaning": "任务"
  },
  {
    "word": "taste",
    "phonetic": "[teɪst]",
    "meaning": "味道"
  },
  {
    "word": "tax",
    "phonetic": "[tæks]",
    "meaning": "税"
  },
  {
    "word": "taxi",
    "phonetic": "[ˈtæksi]",
    "meaning": "出租车"
  },
  {
    "word": "tea",
    "phonetic": "[tiː]",
    "meaning": "茶"
  },
  {
    "word": "teach",
    "phonetic": "[tiːtʃ]",
    "meaning": "教"
  },
  {
    "word": "teacher",
    "phonetic": "[ˈtiːtʃə(r)]",
    "meaning": "教师"
  },
  {
    "word": "teaching",
    "phonetic": "[ˈtiːtʃɪŋ]",
    "meaning": "教学"
  },
  {
    "word": "team",
    "phonetic": "[tiːm]",
    "meaning": "团队"
  },
  {
    "word": "tear",
    "phonetic": "[teə(r)]",
    "meaning": "眼泪"
  },
  {
    "word": "tease",
    "phonetic": "[tiːz]",
    "meaning": "戏弄"
  },
  {
    "word": "technical",
    "phonetic": "[ˈteknɪkl]",
    "meaning": "技术的"
  },
  {
    "word": "technician",
    "phonetic": "[tekˈnɪʃn]",
    "meaning": "技术员"
  },
  {
    "word": "technique",
    "phonetic": "[tekˈniːk]",
    "meaning": "技术"
  },
  {
    "word": "technology",
    "phonetic": "[tekˈnɒlədʒi]",
    "meaning": "技术"
  },
  {
    "word": "teenager",
    "phonetic": "[ˈtiːneɪdʒə(r)]",
    "meaning": "青少年"
  },
  {
    "word": "telephone",
    "phonetic": "[ˈtelɪfəʊn]",
    "meaning": "电话"
  },
  {
    "word": "telescope",
    "phonetic": "[ˈtelɪskəʊp]",
    "meaning": "望远镜"
  },
  {
    "word": "television",
    "phonetic": "[ˈtelɪvɪʒn]",
    "meaning": "电视"
  },
  {
    "word": "tell",
    "phonetic": "[tel]",
    "meaning": "告诉"
  },
  {
    "word": "teller",
    "phonetic": "[ˈtelə(r)]",
    "meaning": "出纳员"
  },
  {
    "word": "temper",
    "phonetic": "[ˈtempə(r)]",
    "meaning": "脾气"
  },
  {
    "word": "temperature",
    "phonetic": "[ˈtemprətʃə(r)]",
    "meaning": "温度"
  },
  {
    "word": "temple",
    "phonetic": "[ˈtempl]",
    "meaning": "寺庙"
  },
  {
    "word": "temporary",
    "phonetic": "[ˈtemprəri]",
    "meaning": "临时的"
  },
  {
    "word": "tempt",
    "phonetic": "[tempt]",
    "meaning": "诱惑"
  },
  {
    "word": "temptation",
    "phonetic": "[tempˈteɪʃn]",
    "meaning": "诱惑"
  },
  {
    "word": "ten",
    "phonetic": "[ten]",
    "meaning": "十"
  },
  {
    "word": "tenant",
    "phonetic": "[ˈtenənt]",
    "meaning": "租户"
  },
  {
    "word": "tend",
    "phonetic": "[tend]",
    "meaning": "趋向"
  },
  {
    "word": "tendency",
    "phonetic": "[ˈtendənsi]",
    "meaning": "趋势"
  },
  {
    "word": "tender",
    "phonetic": "[ˈtendə(r)]",
    "meaning": "温柔的"
  },
  {
    "word": "tennis",
    "phonetic": "[ˈtenɪs]",
    "meaning": "网球"
  },
  {
    "word": "tense",
    "phonetic": "[tens]",
    "meaning": "紧张的"
  },
  {
    "word": "tension",
    "phonetic": "[ˈtenʃn]",
    "meaning": "紧张"
  },
  {
    "word": "tent",
    "phonetic": "[tent]",
    "meaning": "帐篷"
  },
  {
    "word": "term",
    "phonetic": "[tɜːm]",
    "meaning": "学期"
  },
  {
    "word": "terminal",
    "phonetic": "[ˈtɜːmɪnl]",
    "meaning": "终点"
  },
  {
    "word": "terminate",
    "phonetic": "[ˈtɜːmɪneɪt]",
    "meaning": "终止"
  },
  {
    "word": "terrible",
    "phonetic": "[ˈterəbl]",
    "meaning": "可怕的"
  },
  {
    "word": "terrific",
    "phonetic": "[təˈrɪfɪk]",
    "meaning": "极好的"
  },
  {
    "word": "territory",
    "phonetic": "[ˈterətri]",
    "meaning": "领土"
  },
  {
    "word": "terror",
    "phonetic": "[ˈterə(r)]",
    "meaning": "恐怖"
  },
  {
    "word": "terrorist",
    "phonetic": "[ˈterərɪst]",
    "meaning": "恐怖分子"
  },
  {
    "word": "test",
    "phonetic": "[test]",
    "meaning": "测试"
  },
  {
    "word": "text",
    "phonetic": "[tekst]",
    "meaning": "文本"
  },
  {
    "word": "textbook",
    "phonetic": "[ˈtekstbʊk]",
    "meaning": "教科书"
  },
  {
    "word": "textile",
    "phonetic": "[ˈtekstaɪl]",
    "meaning": "纺织品"
  },
  {
    "word": "than",
    "phonetic": "[ðæn]",
    "meaning": "比"
  },
  {
    "word": "thank",
    "phonetic": "[θæŋk]",
    "meaning": "感谢"
  },
  {
    "word": "thanks",
    "phonetic": "[θæŋks]",
    "meaning": "谢谢"
  },
  {
    "word": "that",
    "phonetic": "[ðæt]",
    "meaning": "那个"
  },
  {
    "word": "the",
    "phonetic": "[ðə]",
    "meaning": "这"
  },
  {
    "word": "theater",
    "phonetic": "[ˈθɪətə(r)]",
    "meaning": "剧院"
  },
  {
    "word": "theatre",
    "phonetic": "[ˈθɪətə(r)]",
    "meaning": "剧院"
  },
  {
    "word": "their",
    "phonetic": "[ðeə(r)]",
    "meaning": "他们的"
  },
  {
    "word": "theirs",
    "phonetic": "[ðeəz]",
    "meaning": "他们的"
  },
  {
    "word": "them",
    "phonetic": "[ðem]",
    "meaning": "他们"
  },
  {
    "word": "themselves",
    "phonetic": "[ðəmˈselvz]",
    "meaning": "他们自己"
  },
  {
    "word": "then",
    "phonetic": "[ðen]",
    "meaning": "然后"
  },
  {
    "word": "theory",
    "phonetic": "[ˈθɪəri]",
    "meaning": "理论"
  },
  {
    "word": "therapist",
    "phonetic": "[ˈθerəpɪst]",
    "meaning": "治疗师"
  },
  {
    "word": "therapy",
    "phonetic": "[ˈθerəpi]",
    "meaning": "治疗"
  },
  {
    "word": "there",
    "phonetic": "[ðeə(r)]",
    "meaning": "那里"
  },
  {
    "word": "therefore",
    "phonetic": "[ˈðeəfɔː(r)]",
    "meaning": "因此"
  },
  {
    "word": "thermometer",
    "phonetic": "[θəˈmɒmɪtə(r)]",
    "meaning": "温度计"
  },
  {
    "word": "these",
    "phonetic": "[ðiːz]",
    "meaning": "这些"
  },
  {
    "word": "they",
    "phonetic": "[ðeɪ]",
    "meaning": "他们"
  },
  {
    "word": "thick",
    "phonetic": "[θɪk]",
    "meaning": "厚的"
  },
  {
    "word": "thief",
    "phonetic": "[θiːf]",
    "meaning": "小偷"
  },
  {
    "word": "thieves",
    "phonetic": "[θiːvz]",
    "meaning": "小偷（复数）"
  },
  {
    "word": "thin",
    "phonetic": "[θɪn]",
    "meaning": "瘦的"
  },
  {
    "word": "thing",
    "phonetic": "[θɪŋ]",
    "meaning": "东西"
  },
  {
    "word": "think",
    "phonetic": "[θɪŋk]",
    "meaning": "思考"
  },
  {
    "word": "third",
    "phonetic": "[θɜːd]",
    "meaning": "第三"
  },
  {
    "word": "thirdly",
    "phonetic": "[ˈθɜːdli]",
    "meaning": "第三"
  },
  {
    "word": "thirst",
    "phonetic": "[θɜːst]",
    "meaning": "口渴"
  },
  {
    "word": "thirsty",
    "phonetic": "[ˈθɜːsti]",
    "meaning": "口渴的"
  },
  {
    "word": "thirteen",
    "phonetic": "[ˌθɜːˈtiːn]",
    "meaning": "十三"
  },
  {
    "word": "thirty",
    "phonetic": "[ˈθɜːti]",
    "meaning": "三十"
  },
  {
    "word": "this",
    "phonetic": "[ðɪs]",
    "meaning": "这个"
  },
  {
    "word": "thorough",
    "phonetic": "[ˈθʌrə]",
    "meaning": "彻底的"
  },
  {
    "word": "though",
    "phonetic": "[ðəʊ]",
    "meaning": "虽然"
  },
  {
    "word": "thought",
    "phonetic": "[θɔːt]",
    "meaning": "思想"
  },
  {
    "word": "thousand",
    "phonetic": "[ˈθaʊznd]",
    "meaning": "千"
  },
  {
    "word": "thread",
    "phonetic": "[θred]",
    "meaning": "线"
  },
  {
    "word": "threat",
    "phonetic": "[θret]",
    "meaning": "威胁"
  },
  {
    "word": "threaten",
    "phonetic": "[ˈθretn]",
    "meaning": "威胁"
  },
  {
    "word": "three",
    "phonetic": "[θriː]",
    "meaning": "三"
  },
  {
    "word": "thrift",
    "phonetic": "[θrɪft]",
    "meaning": "节俭"
  },
  {
    "word": "throne",
    "phonetic": "[θrəʊn]",
    "meaning": "王座"
  },
  {
    "word": "throat",
    "phonetic": "[θrəʊt]",
    "meaning": "喉咙"
  },
  {
    "word": "through",
    "phonetic": "[θruː]",
    "meaning": "通过"
  },
  {
    "word": "throughout",
    "phonetic": "[θruːˈaʊt]",
    "meaning": "遍及"
  },
  {
    "word": "throw",
    "phonetic": "[θrəʊ]",
    "meaning": "扔"
  },
  {
    "word": "thrown",
    "phonetic": "[θrəʊn]",
    "meaning": "扔（过去分词）"
  },
  {
    "word": "thumb",
    "phonetic": "[θʌm]",
    "meaning": "拇指"
  },
  {
    "word": "thunder",
    "phonetic": "[ˈθʌndə(r)]",
    "meaning": "雷声"
  },
  {
    "word": "Thursday",
    "phonetic": "[ˈθɜːzdeɪ]",
    "meaning": "星期四"
  },
  {
    "word": "thus",
    "phonetic": "[ðʌs]",
    "meaning": "因此"
  },
  {
    "word": "ticket",
    "phonetic": "[ˈtɪkɪt]",
    "meaning": "票"
  },
  {
    "word": "tidy",
    "phonetic": "[ˈtaɪdi]",
    "meaning": "整洁的"
  },
  {
    "word": "tie",
    "phonetic": "[taɪ]",
    "meaning": "系"
  },
  {
    "word": "tiger",
    "phonetic": "[ˈtaɪɡə(r)]",
    "meaning": "老虎"
  },
  {
    "word": "tight",
    "phonetic": "[taɪt]",
    "meaning": "紧的"
  },
  {
    "word": "tightly",
    "phonetic": "[ˈtaɪtli]",
    "meaning": "紧紧地"
  },
  {
    "word": "tile",
    "phonetic": "[taɪl]",
    "meaning": "瓦片"
  },
  {
    "word": "till",
    "phonetic": "[tɪl]",
    "meaning": "直到"
  },
  {
    "word": "time",
    "phonetic": "[taɪm]",
    "meaning": "时间"
  },
  {
    "word": "timely",
    "phonetic": "[ˈtaɪmli]",
    "meaning": "及时的"
  },
  {
    "word": "timer",
    "phonetic": "[ˈtaɪmə(r)]",
    "meaning": "计时器"
  },
  {
    "word": "tin",
    "phonetic": "[tɪn]",
    "meaning": "锡"
  },
  {
    "word": "tiny",
    "phonetic": "[ˈtaɪni]",
    "meaning": "极小的"
  },
  {
    "word": "tip",
    "phonetic": "[tɪp]",
    "meaning": "小费"
  },
  {
    "word": "tire",
    "phonetic": "[ˈtaɪə(r)]",
    "meaning": "使疲倦"
  },
  {
    "word": "tired",
    "phonetic": "[ˈtaɪəd]",
    "meaning": "疲倦的"
  },
  {
    "word": "tiresome",
    "phonetic": "[ˈtaɪəsəm]",
    "meaning": "令人疲倦的"
  },
  {
    "word": "tissue",
    "phonetic": "[ˈtɪʃuː]",
    "meaning": "纸巾"
  },
  {
    "word": "title",
    "phonetic": "[ˈtaɪtl]",
    "meaning": "标题"
  },
  {
    "word": "to",
    "phonetic": "[tuː]",
    "meaning": "到"
  },
  {
    "word": "toast",
    "phonetic": "[təʊst]",
    "meaning": "烤面包"
  },
  {
    "word": "tobacco",
    "phonetic": "[təˈbækəʊ]",
    "meaning": "烟草"
  },
  {
    "word": "today",
    "phonetic": "[təˈdeɪ]",
    "meaning": "今天"
  },
  {
    "word": "toe",
    "phonetic": "[təʊ]",
    "meaning": "脚趾"
  },
  {
    "word": "together",
    "phonetic": "[təˈɡeðə(r)]",
    "meaning": "一起"
  },
  {
    "word": "toilet",
    "phonetic": "[ˈtɔɪlət]",
    "meaning": "厕所"
  },
  {
    "word": "token",
    "phonetic": "[ˈtəʊkən]",
    "meaning": "代币"
  },
  {
    "word": "tolerance",
    "phonetic": "[ˈtɒlərəns]",
    "meaning": "容忍"
  },
  {
    "word": "tolerant",
    "phonetic": "[ˈtɒlərənt]",
    "meaning": "容忍的"
  },
  {
    "word": "tolerate",
    "phonetic": "[ˈtɒləreɪt]",
    "meaning": "容忍"
  },
  {
    "word": "tomato",
    "phonetic": "[təˈmɑːtəʊ]",
    "meaning": "西红柿"
  },
  {
    "word": "tomorrow",
    "phonetic": "[təˈmɒrəʊ]",
    "meaning": "明天"
  },
  {
    "word": "tone",
    "phonetic": "[təʊn]",
    "meaning": "音调"
  },
  {
    "word": "tongue",
    "phonetic": "[tʌŋ]",
    "meaning": "舌头"
  },
  {
    "word": "tonight",
    "phonetic": "[təˈnaɪt]",
    "meaning": "今晚"
  },
  {
    "word": "too",
    "phonetic": "[tuː]",
    "meaning": "也"
  },
  {
    "word": "tool",
    "phonetic": "[tuːl]",
    "meaning": "工具"
  },
  {
    "word": "tooth",
    "phonetic": "[tuːθ]",
    "meaning": "牙齿"
  },
  {
    "word": "toothache",
    "phonetic": "[ˈtuːθeɪk]",
    "meaning": "牙痛"
  },
  {
    "word": "toothbrush",
    "phonetic": "[ˈtuːθbrʌʃ]",
    "meaning": "牙刷"
  },
  {
    "word": "toothpaste",
    "phonetic": "[ˈtuːθpeɪst]",
    "meaning": "牙膏"
  },
  {
    "word": "top",
    "phonetic": "[tɒp]",
    "meaning": "顶部"
  },
  {
    "word": "topic",
    "phonetic": "[ˈtɒpɪk]",
    "meaning": "话题"
  },
  {
    "word": "torch",
    "phonetic": "[tɔːtʃ]",
    "meaning": "手电筒"
  },
  {
    "word": "tortoise",
    "phonetic": "[ˈtɔːtəs]",
    "meaning": "乌龟"
  },
  {
    "word": "torture",
    "phonetic": "[ˈtɔːtʃə(r)]",
    "meaning": "酷刑"
  },
  {
    "word": "total",
    "phonetic": "[ˈtəʊtl]",
    "meaning": "总计"
  },
  {
    "word": "totally",
    "phonetic": "[ˈtəʊtəli]",
    "meaning": "完全地"
  },
  {
    "word": "touch",
    "phonetic": "[tʌtʃ]",
    "meaning": "触摸"
  },
  {
    "word": "tough",
    "phonetic": "[tʌf]",
    "meaning": "艰难的"
  },
  {
    "word": "tour",
    "phonetic": "[tʊə(r)]",
    "meaning": "旅行"
  },
  {
    "word": "tourism",
    "phonetic": "[ˈtʊərɪzəm]",
    "meaning": "旅游业"
  },
  {
    "word": "tourist",
    "phonetic": "[ˈtʊərɪst]",
    "meaning": "游客"
  },
  {
    "word": "toward",
    "phonetic": "[təˈwɔːd]",
    "meaning": "朝向"
  },
  {
    "word": "towards",
    "phonetic": "[təˈwɔːdz]",
    "meaning": "朝向"
  },
  {
    "word": "towel",
    "phonetic": "[ˈtaʊəl]",
    "meaning": "毛巾"
  },
  {
    "word": "tower",
    "phonetic": "[ˈtaʊə(r)]",
    "meaning": "塔"
  },
  {
    "word": "town",
    "phonetic": "[taʊn]",
    "meaning": "城镇"
  },
  {
    "word": "toy",
    "phonetic": "[tɔɪ]",
    "meaning": "玩具"
  },
  {
    "word": "track",
    "phonetic": "[træk]",
    "meaning": "轨道"
  },
  {
    "word": "tractor",
    "phonetic": "[ˈtræktə(r)]",
    "meaning": "拖拉机"
  },
  {
    "word": "trade",
    "phonetic": "[treɪd]",
    "meaning": "贸易"
  },
  {
    "word": "tradition",
    "phonetic": "[trəˈdɪʃn]",
    "meaning": "传统"
  },
  {
    "word": "traditional",
    "phonetic": "[trəˈdɪʃənl]",
    "meaning": "传统的"
  },
  {
    "word": "traffic",
    "phonetic": "[ˈtræfɪk]",
    "meaning": "交通"
  },
  {
    "word": "tragedy",
    "phonetic": "[ˈtrædʒədi]",
    "meaning": "悲剧"
  },
  {
    "word": "tragic",
    "phonetic": "[ˈtrædʒɪk]",
    "meaning": "悲剧的"
  },
  {
    "word": "trail",
    "phonetic": "[treɪl]",
    "meaning": "小径"
  },
  {
    "word": "train",
    "phonetic": "[treɪn]",
    "meaning": "火车"
  },
  {
    "word": "training",
    "phonetic": "[ˈtreɪnɪŋ]",
    "meaning": "训练"
  },
  {
    "word": "trait",
    "phonetic": "[treɪt]",
    "meaning": "特点"
  },
  {
    "word": "tram",
    "phonetic": "[træm]",
    "meaning": "电车"
  },
  {
    "word": "tramp",
    "phonetic": "[træmp]",
    "meaning": "流浪者"
  },
  {
    "word": "trample",
    "phonetic": "[ˈtræmpl]",
    "meaning": "践踏"
  },
  {
    "word": "transaction",
    "phonetic": "[trænˈzækʃn]",
    "meaning": "交易"
  },
  {
    "word": "transfer",
    "phonetic": "[trænsˈfɜː(r)]",
    "meaning": "转移"
  },
  {
    "word": "transform",
    "phonetic": "[trænsˈfɔːm]",
    "meaning": "转变"
  },
  {
    "word": "transformation",
    "phonetic": "[ˌtrænsfəˈmeɪʃn]",
    "meaning": "转变"
  },
  {
    "word": "translate",
    "phonetic": "[trænsˈleɪt]",
    "meaning": "翻译"
  },
  {
    "word": "translation",
    "phonetic": "[trænsˈleɪʃn]",
    "meaning": "翻译"
  },
  {
    "word": "translator",
    "phonetic": "[trænsˈleɪtə(r)]",
    "meaning": "译者"
  },
  {
    "word": "transmit",
    "phonetic": "[trænzˈmɪt]",
    "meaning": "传输"
  },
  {
    "word": "transparent",
    "phonetic": "[trænsˈpærənt]",
    "meaning": "透明的"
  },
  {
    "word": "transport",
    "phonetic": "[ˈtrænspɔːt]",
    "meaning": "运输"
  },
  {
    "word": "transportation",
    "phonetic": "[ˌtrænspɔːˈteɪʃn]",
    "meaning": "交通"
  },
  {
    "word": "trap",
    "phonetic": "[træp]",
    "meaning": "陷阱"
  },
  {
    "word": "travel",
    "phonetic": "[ˈtrævl]",
    "meaning": "旅行"
  },
  {
    "word": "traveler",
    "phonetic": "[ˈtrævlə(r)]",
    "meaning": "旅行者"
  },
  {
    "word": "tray",
    "phonetic": "[treɪ]",
    "meaning": "托盘"
  },
  {
    "word": "treasure",
    "phonetic": "[ˈtreʒə(r)]",
    "meaning": "宝藏"
  },
  {
    "word": "treat",
    "phonetic": "[triːt]",
    "meaning": "对待"
  },
  {
    "word": "treatment",
    "phonetic": "[ˈtriːtmənt]",
    "meaning": "治疗"
  },
  {
    "word": "treaty",
    "phonetic": "[ˈtriːti]",
    "meaning": "条约"
  },
  {
    "word": "tree",
    "phonetic": "[triː]",
    "meaning": "树"
  },
  {
    "word": "tremble",
    "phonetic": "[ˈtrembl]",
    "meaning": "颤抖"
  },
  {
    "word": "tremendous",
    "phonetic": "[trəˈmendəs]",
    "meaning": "巨大的"
  },
  {
    "word": "trend",
    "phonetic": "[trend]",
    "meaning": "趋势"
  },
  {
    "word": "trial",
    "phonetic": "[ˈtraɪəl]",
    "meaning": "审判"
  },
  {
    "word": "triangle",
    "phonetic": "[ˈtraɪæŋɡl]",
    "meaning": "三角形"
  },
  {
    "word": "trick",
    "phonetic": "[trɪk]",
    "meaning": "诡计"
  },
  {
    "word": "tricycle",
    "phonetic": "[ˈtraɪsɪkl]",
    "meaning": "三轮车"
  },
  {
    "word": "trip",
    "phonetic": "[trɪp]",
    "meaning": "旅行"
  },
  {
    "word": "triple",
    "phonetic": "[ˈtrɪpl]",
    "meaning": "三倍的"
  },
  {
    "word": "troop",
    "phonetic": "[truːp]",
    "meaning": "军队"
  },
  {
    "word": "trouble",
    "phonetic": "[ˈtrʌbl]",
    "meaning": "麻烦"
  },
  {
    "word": "troublesome",
    "phonetic": "[ˈtrʌblsəm]",
    "meaning": "麻烦的"
  },
  {
    "word": "trousers",
    "phonetic": "[ˈtraʊzəz]",
    "meaning": "裤子"
  },
  {
    "word": "truck",
    "phonetic": "[trʌk]",
    "meaning": "卡车"
  },
  {
    "word": "true",
    "phonetic": "[truː]",
    "meaning": "真实的"
  },
  {
    "word": "truly",
    "phonetic": "[ˈtruːli]",
    "meaning": "真实地"
  },
  {
    "word": "trunk",
    "phonetic": "[trʌŋk]",
    "meaning": "树干"
  },
  {
    "word": "trust",
    "phonetic": "[trʌst]",
    "meaning": "信任"
  },
  {
    "word": "truth",
    "phonetic": "[truːθ]",
    "meaning": "真相"
  },
  {
    "word": "truthful",
    "phonetic": "[ˈtruːθfl]",
    "meaning": "诚实的"
  },
  {
    "word": "try",
    "phonetic": "[traɪ]",
    "meaning": "尝试"
  },
  {
    "word": "tube",
    "phonetic": "[tjuːb]",
    "meaning": "管"
  },
  {
    "word": "Tuesday",
    "phonetic": "[ˈtjuːzdeɪ]",
    "meaning": "星期二"
  },
  {
    "word": "tuition",
    "phonetic": "[tjuˈɪʃn]",
    "meaning": "学费"
  },
  {
    "word": "tumble",
    "phonetic": "[ˈtʌmbl]",
    "meaning": "跌倒"
  },
  {
    "word": "tunnel",
    "phonetic": "[ˈtʌnl]",
    "meaning": "隧道"
  },
  {
    "word": "turkey",
    "phonetic": "[ˈtɜːki]",
    "meaning": "火鸡"
  },
  {
    "word": "turn",
    "phonetic": "[tɜːn]",
    "meaning": "转动"
  },
  {
    "word": "turning",
    "phonetic": "[ˈtɜːnɪŋ]",
    "meaning": "转弯"
  },
  {
    "word": "turnip",
    "phonetic": "[ˈtɜːnɪp]",
    "meaning": "萝卜"
  },
  {
    "word": "tutor",
    "phonetic": "[ˈtjuːtə(r)]",
    "meaning": "导师"
  },
  {
    "word": "TV",
    "phonetic": "[ˌtiː ˈviː]",
    "meaning": "电视"
  },
  {
    "word": "twelfth",
    "phonetic": "[twelfθ]",
    "meaning": "第十二"
  },
  {
    "word": "twenty",
    "phonetic": "[ˈtwenti]",
    "meaning": "二十"
  },
  {
    "word": "twenty-first",
    "phonetic": "[ˌtwenti ˈfɜːst]",
    "meaning": "第二十一"
  },
  {
    "word": "twenty-one",
    "phonetic": "[ˌtwenti ˈwʌn]",
    "meaning": "二十一"
  },
  {
    "word": "twice",
    "phonetic": "[twaɪs]",
    "meaning": "两次"
  },
  {
    "word": "twin",
    "phonetic": "[twɪn]",
    "meaning": "双胞胎"
  },
  {
    "word": "twist",
    "phonetic": "[twɪst]",
    "meaning": "扭曲"
  },
  {
    "word": "two",
    "phonetic": "[tuː]",
    "meaning": "二"
  },
  {
    "word": "type",
    "phonetic": "[taɪp]",
    "meaning": "类型"
  },
  {
    "word": "typewriter",
    "phonetic": "[ˈtaɪpraɪtə(r)]",
    "meaning": "打字机"
  },
  {
    "word": "typhoon",
    "phonetic": "[taɪˈfuːn]",
    "meaning": "台风"
  },
  {
    "word": "typical",
    "phonetic": "[ˈtɪpɪkl]",
    "meaning": "典型的"
  },
  {
    "word": "typist",
    "phonetic": "[ˈtaɪpɪst]",
    "meaning": "打字员"
  },
  {
    "word": "ugly",
    "phonetic": "[ˈʌɡli]",
    "meaning": "丑陋的"
  },
  {
    "word": "umbrella",
    "phonetic": "[ʌmˈbrelə]",
    "meaning": "雨伞"
  },
  {
    "word": "unable",
    "phonetic": "[ʌnˈeɪbl]",
    "meaning": "不能的"
  },
  {
    "word": "unbearable",
    "phonetic": "[ʌnˈbeərəbl]",
    "meaning": "无法忍受的"
  },
  {
    "word": "unbelievable",
    "phonetic": "[ˌʌnbɪˈliːvəbl]",
    "meaning": "难以置信的"
  },
  {
    "word": "uncle",
    "phonetic": "[ˈʌŋkl]",
    "meaning": "叔叔"
  },
  {
    "word": "unconscious",
    "phonetic": "[ʌnˈkɒnʃəs]",
    "meaning": "无意识的"
  },
  {
    "word": "under",
    "phonetic": "[ˈʌndə(r)]",
    "meaning": "在...下面"
  },
  {
    "word": "underground",
    "phonetic": "[ˌʌndəˈɡraʊnd]",
    "meaning": "地下的"
  },
  {
    "word": "underline",
    "phonetic": "[ˌʌndəˈlaɪn]",
    "meaning": "下划线"
  },
  {
    "word": "understanding",
    "phonetic": "[ˌʌndəˈstændɪŋ]",
    "meaning": "理解"
  },
  {
    "word": "undertake",
    "phonetic": "[ˌʌndəˈteɪk]",
    "meaning": "承担"
  },
  {
    "word": "undertaking",
    "phonetic": "[ˌʌndəˈteɪkɪŋ]",
    "meaning": "事业"
  },
  {
    "word": "underwear",
    "phonetic": "[ˈʌndəweə(r)]",
    "meaning": "内衣"
  },
  {
    "word": "undo",
    "phonetic": "[ʌnˈduː]",
    "meaning": "撤销"
  },
  {
    "word": "unexpected",
    "phonetic": "[ˌʌnɪkˈspektɪd]",
    "meaning": "意外的"
  },
  {
    "word": "unfair",
    "phonetic": "[ˌʌnˈfeə(r)]",
    "meaning": "不公平的"
  },
  {
    "word": "unfortunate",
    "phonetic": "[ʌnˈfɔːtʃənət]",
    "meaning": "不幸的"
  },
  {
    "word": "unfortunately",
    "phonetic": "[ʌnˈfɔːtʃənətli]",
    "meaning": "不幸地"
  },
  {
    "word": "unhappy",
    "phonetic": "[ʌnˈhæpi]",
    "meaning": "不快乐的"
  },
  {
    "word": "uniform",
    "phonetic": "[ˈjuːnɪfɔːm]",
    "meaning": "制服"
  },
  {
    "word": "unite",
    "phonetic": "[juːˈnaɪt]",
    "meaning": "联合"
  },
  {
    "word": "unit",
    "phonetic": "[ˈjuːnɪt]",
    "meaning": "单位"
  },
  {
    "word": "united",
    "phonetic": "[juːˈnaɪtɪd]",
    "meaning": "联合的"
  },
  {
    "word": "universal",
    "phonetic": "[ˌjuːnɪˈvɜːsl]",
    "meaning": "普遍的"
  },
  {
    "word": "university",
    "phonetic": "[ˌjuːnɪˈvɜːsəti]",
    "meaning": "大学"
  },
  {
    "word": "unknown",
    "phonetic": "[ˌʌnˈnəʊn]",
    "meaning": "未知的"
  },
  {
    "word": "unless",
    "phonetic": "[ənˈles]",
    "meaning": "除非"
  },
  {
    "word": "unlike",
    "phonetic": "[ˌʌnˈlaɪk]",
    "meaning": "不像"
  },
  {
    "word": "unlikely",
    "phonetic": "[ʌnˈlaɪkli]",
    "meaning": "不太可能的"
  },
  {
    "word": "unload",
    "phonetic": "[ˌʌnˈləʊd]",
    "meaning": "卸货"
  },
  {
    "word": "unlucky",
    "phonetic": "[ʌnˈlʌki]",
    "meaning": "不幸的"
  },
  {
    "word": "unnecessary",
    "phonetic": "[ʌnˈnesəsəri]",
    "meaning": "不必要的"
  },
  {
    "word": "unpleasant",
    "phonetic": "[ʌnˈpleznt]",
    "meaning": "不愉快的"
  },
  {
    "word": "unrest",
    "phonetic": "[ʌnˈrest]",
    "meaning": "不安"
  },
  {
    "word": "unsafe",
    "phonetic": "[ʌnˈseɪf]",
    "meaning": "不安全的"
  },
  {
    "word": "unsuitable",
    "phonetic": "[ʌnˈsuːtəbl]",
    "meaning": "不合适的"
  },
  {
    "word": "until",
    "phonetic": "[ənˈtɪl]",
    "meaning": "直到"
  },
  {
    "word": "unusual",
    "phonetic": "[ʌnˈjuːʒuəl]",
    "meaning": "不寻常的"
  },
  {
    "word": "unwilling",
    "phonetic": "[ʌnˈwɪlɪŋ]",
    "meaning": "不愿意的"
  },
  {
    "word": "up",
    "phonetic": "[ʌp]",
    "meaning": "向上"
  },
  {
    "word": "upon",
    "phonetic": "[əˈpɒn]",
    "meaning": "在...上"
  },
  {
    "word": "upper",
    "phonetic": "[ˈʌpə(r)]",
    "meaning": "上面的"
  },
  {
    "word": "upset",
    "phonetic": "[ʌpˈset]",
    "meaning": "使心烦"
  },
  {
    "word": "upstairs",
    "phonetic": "[ˌʌpˈsteəz]",
    "meaning": "楼上"
  },
  {
    "word": "upward",
    "phonetic": "[ˈʌpwəd]",
    "meaning": "向上的"
  },
  {
    "word": "upwards",
    "phonetic": "[ˈʌpwədz]",
    "meaning": "向上"
  },
  {
    "word": "urban",
    "phonetic": "[ˈɜːbən]",
    "meaning": "城市的"
  },
  {
    "word": "urge",
    "phonetic": "[ɜːdʒ]",
    "meaning": "催促"
  },
  {
    "word": "urgent",
    "phonetic": "[ˈɜːdʒənt]",
    "meaning": "紧急的"
  },
  {
    "word": "us",
    "phonetic": "[əs]",
    "meaning": "我们"
  },
  {
    "word": "usage",
    "phonetic": "[ˈjuːsɪdʒ]",
    "meaning": "使用"
  },
  {
    "word": "use",
    "phonetic": "[juːz]",
    "meaning": "使用"
  },
  {
    "word": "used",
    "phonetic": "[juːzd]",
    "meaning": "使用过的"
  },
  {
    "word": "useful",
    "phonetic": "[ˈjuːsfl]",
    "meaning": "有用的"
  },
  {
    "word": "useless",
    "phonetic": "[ˈjuːsləs]",
    "meaning": "无用的"
  },
  {
    "word": "user",
    "phonetic": "[ˈjuːzə(r)]",
    "meaning": "用户"
  },
  {
    "word": "usual",
    "phonetic": "[ˈjuːʒuəl]",
    "meaning": "通常的"
  },
  {
    "word": "usually",
    "phonetic": "[ˈjuːʒuəli]",
    "meaning": "通常"
  },
  {
    "word": "utensil",
    "phonetic": "[juːˈtensl]",
    "meaning": "用具"
  },
  {
    "word": "utility",
    "phonetic": "[juːˈtɪləti]",
    "meaning": "效用"
  },
  {
    "word": "utilize",
    "phonetic": "[ˈjuːtəlaɪz]",
    "meaning": "利用"
  },
  {
    "word": "utilization",
    "phonetic": "[ˌjuːtəlaɪˈzeɪʃn]",
    "meaning": "利用"
  },
  {
    "word": "utmost",
    "phonetic": "[ˈʌtməʊst]",
    "meaning": "极度的"
  },
  {
    "word": "utter",
    "phonetic": "[ˈʌtə(r)]",
    "meaning": "完全的"
  },
  {
    "word": "vacation",
    "phonetic": "[veɪˈkeɪʃn]",
    "meaning": "假期"
  },
  {
    "word": "vacant",
    "phonetic": "[ˈveɪkənt]",
    "meaning": "空的"
  },
  {
    "word": "vacancy",
    "phonetic": "[ˈveɪkənsi]",
    "meaning": "空缺"
  },
  {
    "word": "vacuum",
    "phonetic": "[ˈvækjuəm]",
    "meaning": "真空"
  },
  {
    "word": "vague",
    "phonetic": "[veɪɡ]",
    "meaning": "模糊的"
  },
  {
    "word": "vain",
    "phonetic": "[veɪn]",
    "meaning": "虚荣的"
  },
  {
    "word": "valid",
    "phonetic": "[ˈvælɪd]",
    "meaning": "有效的"
  },
  {
    "word": "validity",
    "phonetic": "[vəˈlɪdəti]",
    "meaning": "有效性"
  },
  {
    "word": "valley",
    "phonetic": "[ˈvæli]",
    "meaning": "山谷"
  },
  {
    "word": "valuable",
    "phonetic": "[ˈvæljuəbl]",
    "meaning": "有价值的"
  },
  {
    "word": "value",
    "phonetic": "[ˈvæljuː]",
    "meaning": "价值"
  },
  {
    "word": "valueless",
    "phonetic": "[ˈvæljuːləs]",
    "meaning": "无价值的"
  },
  {
    "word": "van",
    "phonetic": "[væn]",
    "meaning": "面包车"
  },
  {
    "word": "vanish",
    "phonetic": "[ˈvænɪʃ]",
    "meaning": "消失"
  },
  {
    "word": "vapor",
    "phonetic": "[ˈveɪpə(r)]",
    "meaning": "蒸汽"
  },
  {
    "word": "variable",
    "phonetic": "[ˈveəriəbl]",
    "meaning": "可变的"
  },
  {
    "word": "variation",
    "phonetic": "[ˌveəriˈeɪʃn]",
    "meaning": "变化"
  },
  {
    "word": "variety",
    "phonetic": "[vəˈraɪəti]",
    "meaning": "多样性"
  },
  {
    "word": "various",
    "phonetic": "[ˈveəriəs]",
    "meaning": "各种各样的"
  },
  {
    "word": "vary",
    "phonetic": "[ˈveəri]",
    "meaning": "变化"
  },
  {
    "word": "vase",
    "phonetic": "[vɑːz]",
    "meaning": "花瓶"
  },
  {
    "word": "vast",
    "phonetic": "[vɑːst]",
    "meaning": "广阔的"
  },
  {
    "word": "vegetable",
    "phonetic": "[ˈvedʒtəbl]",
    "meaning": "蔬菜"
  },
  {
    "word": "vegetarian",
    "phonetic": "[ˌvedʒəˈteəriən]",
    "meaning": "素食者"
  },
  {
    "word": "vehicle",
    "phonetic": "[ˈviːəkl]",
    "meaning": "车辆"
  },
  {
    "word": "velvet",
    "phonetic": "[ˈvelvɪt]",
    "meaning": "天鹅绒"
  },
  {
    "word": "vendor",
    "phonetic": "[ˈvendə(r)]",
    "meaning": "小贩"
  },
  {
    "word": "venture",
    "phonetic": "[ˈventʃə(r)]",
    "meaning": "冒险"
  },
  {
    "word": "venue",
    "phonetic": "[ˈvenjuː]",
    "meaning": "场地"
  },
  {
    "word": "verb",
    "phonetic": "[vɜːb]",
    "meaning": "动词"
  },
  {
    "word": "verify",
    "phonetic": "[ˈverɪfaɪ]",
    "meaning": "核实"
  },
  {
    "word": "version",
    "phonetic": "[ˈvɜːʃn]",
    "meaning": "版本"
  },
  {
    "word": "vertical",
    "phonetic": "[ˈvɜːtɪkl]",
    "meaning": "垂直的"
  },
  {
    "word": "very",
    "phonetic": "[ˈveri]",
    "meaning": "非常"
  },
  {
    "word": "vessel",
    "phonetic": "[ˈvesl]",
    "meaning": "容器"
  },
  {
    "word": "veteran",
    "phonetic": "[ˈvetərən]",
    "meaning": "老兵"
  },
  {
    "word": "via",
    "phonetic": "[ˈvaɪə]",
    "meaning": "通过"
  },
  {
    "word": "violate",
    "phonetic": "[ˈvaɪəleɪt]",
    "meaning": "违反"
  },
  {
    "word": "violation",
    "phonetic": "[ˌvaɪəˈleɪʃn]",
    "meaning": "违反"
  },
  {
    "word": "violence",
    "phonetic": "[ˈvaɪələns]",
    "meaning": "暴力"
  },
  {
    "word": "violent",
    "phonetic": "[ˈvaɪələnt]",
    "meaning": "暴力的"
  },
  {
    "word": "violet",
    "phonetic": "[ˈvaɪələt]",
    "meaning": "紫罗兰"
  },
  {
    "word": "violin",
    "phonetic": "[ˌvaɪəˈlɪn]",
    "meaning": "小提琴"
  },
  {
    "word": "virtual",
    "phonetic": "[ˈvɜːtʃuəl]",
    "meaning": "虚拟的"
  },
  {
    "word": "virtually",
    "phonetic": "[ˈvɜːtʃuəli]",
    "meaning": "实际上"
  },
  {
    "word": "virtue",
    "phonetic": "[ˈvɜːtʃuː]",
    "meaning": "美德"
  },
  {
    "word": "virus",
    "phonetic": "[ˈvaɪrəs]",
    "meaning": "病毒"
  },
  {
    "word": "visa",
    "phonetic": "[ˈviːzə]",
    "meaning": "签证"
  },
  {
    "word": "visit",
    "phonetic": "[ˈvɪzɪt]",
    "meaning": "访问"
  },
  {
    "word": "visitor",
    "phonetic": "[ˈvɪzɪtə(r)]",
    "meaning": "访问者"
  },
  {
    "word": "visual",
    "phonetic": "[ˈvɪʒuəl]",
    "meaning": "视觉的"
  },
  {
    "word": "vital",
    "phonetic": "[ˈvaɪtl]",
    "meaning": "至关重要的"
  },
  {
    "word": "vitamin",
    "phonetic": "[ˈvɪtəmɪn]",
    "meaning": "维生素"
  },
  {
    "word": "vivid",
    "phonetic": "[ˈvɪvɪd]",
    "meaning": "生动的"
  },
  {
    "word": "vocabulary",
    "phonetic": "[vəˈkæbjələri]",
    "meaning": "词汇"
  },
  {
    "word": "vocal",
    "phonetic": "[ˈvəʊkl]",
    "meaning": "声音的"
  },
  {
    "word": "vocational",
    "phonetic": "[vəʊˈkeɪʃənl]",
    "meaning": "职业的"
  },
  {
    "word": "voice",
    "phonetic": "[vɔɪs]",
    "meaning": "声音"
  },
  {
    "word": "volcano",
    "phonetic": "[vɒlˈkeɪnəʊ]",
    "meaning": "火山"
  },
  {
    "word": "volleyball",
    "phonetic": "[ˈvɒlibɔːl]",
    "meaning": "排球"
  },
  {
    "word": "volume",
    "phonetic": "[ˈvɒljuːm]",
    "meaning": "体积"
  },
  {
    "word": "voluntary",
    "phonetic": "[ˈvɒləntri]",
    "meaning": "自愿的"
  },
  {
    "word": "volunteer",
    "phonetic": "[ˌvɒlənˈtɪə(r)]",
    "meaning": "志愿者"
  },
  {
    "word": "vote",
    "phonetic": "[vəʊt]",
    "meaning": "投票"
  },
  {
    "word": "voyage",
    "phonetic": "[ˈvɔɪɪdʒ]",
    "meaning": "航行"
  },
  {
    "word": "vulgar",
    "phonetic": "[ˈvʌlɡə(r)]",
    "meaning": "粗俗的"
  },
  {
    "word": "vulture",
    "phonetic": "[ˈvʌltʃə(r)]",
    "meaning": "秃鹫"
  },
  {
    "word": "wage",
    "phonetic": "[weɪdʒ]",
    "meaning": "工资"
  },
  {
    "word": "wait",
    "phonetic": "[weɪt]",
    "meaning": "等待"
  },
  {
    "word": "waiter",
    "phonetic": "[ˈweɪtə(r)]",
    "meaning": "服务员"
  },
  {
    "word": "waitress",
    "phonetic": "[ˈweɪtrəs]",
    "meaning": "女服务员"
  },
  {
    "word": "wake",
    "phonetic": "[weɪk]",
    "meaning": "醒来"
  },
  {
    "word": "walk",
    "phonetic": "[wɔːk]",
    "meaning": "步行"
  },
  {
    "word": "wall",
    "phonetic": "[wɔːl]",
    "meaning": "墙"
  },
  {
    "word": "wallet",
    "phonetic": "[ˈwɒlɪt]",
    "meaning": "钱包"
  },
  {
    "word": "wander",
    "phonetic": "[ˈwɒndə(r)]",
    "meaning": "漫步"
  },
  {
    "word": "want",
    "phonetic": "[wɒnt]",
    "meaning": "想要"
  },
  {
    "word": "war",
    "phonetic": "[wɔː(r)]",
    "meaning": "战争"
  },
  {
    "word": "ward",
    "phonetic": "[wɔːd]",
    "meaning": "病房"
  },
  {
    "word": "warehouse",
    "phonetic": "[ˈweəhaʊs]",
    "meaning": "仓库"
  },
  {
    "word": "warm",
    "phonetic": "[wɔːm]",
    "meaning": "温暖的"
  },
  {
    "word": "warmth",
    "phonetic": "[wɔːmθ]",
    "meaning": "温暖"
  },
  {
    "word": "warn",
    "phonetic": "[wɔːn]",
    "meaning": "警告"
  },
  {
    "word": "warning",
    "phonetic": "[ˈwɔːnɪŋ]",
    "meaning": "警告"
  },
  {
    "word": "wash",
    "phonetic": "[wɒʃ]",
    "meaning": "洗"
  },
  {
    "word": "washer",
    "phonetic": "[ˈwɒʃə(r)]",
    "meaning": "洗衣机"
  },
  {
    "word": "washing",
    "phonetic": "[ˈwɒʃɪŋ]",
    "meaning": "洗涤"
  },
  {
    "word": "waste",
    "phonetic": "[weɪst]",
    "meaning": "浪费"
  },
  {
    "word": "watch",
    "phonetic": "[wɒtʃ]",
    "meaning": "手表"
  },
  {
    "word": "water",
    "phonetic": "[ˈwɔːtə(r)]",
    "meaning": "水"
  },
  {
    "word": "watermelon",
    "phonetic": "[ˈwɔːtəmelən]",
    "meaning": "西瓜"
  },
  {
    "word": "wave",
    "phonetic": "[weɪv]",
    "meaning": "波浪"
  },
  {
    "word": "wax",
    "phonetic": "[wæks]",
    "meaning": "蜡"
  },
  {
    "word": "way",
    "phonetic": "[weɪ]",
    "meaning": "方法"
  },
  {
    "word": "wealth",
    "phonetic": "[welθ]",
    "meaning": "财富"
  },
  {
    "word": "wealthy",
    "phonetic": "[ˈwelθi]",
    "meaning": "富有的"
  },
  {
    "word": "wear",
    "phonetic": "[weə(r)]",
    "meaning": "穿"
  },
  {
    "word": "weather",
    "phonetic": "[ˈweðə(r)]",
    "meaning": "天气"
  },
  {
    "word": "weave",
    "phonetic": "[wiːv]",
    "meaning": "编织"
  },
  {
    "word": "web",
    "phonetic": "[web]",
    "meaning": "网"
  },
  {
    "word": "website",
    "phonetic": "[ˈwebsaɪt]",
    "meaning": "网站"
  },
  {
    "word": "wedding",
    "phonetic": "[ˈwedɪŋ]",
    "meaning": "婚礼"
  },
  {
    "word": "Wednesday",
    "phonetic": "[ˈwenzdeɪ]",
    "meaning": "星期三"
  },
  {
    "word": "weed",
    "phonetic": "[wiːd]",
    "meaning": "杂草"
  },
  {
    "word": "week",
    "phonetic": "[wiːk]",
    "meaning": "周"
  },
  {
    "word": "weekday",
    "phonetic": "[ˈwiːkdeɪ]",
    "meaning": "工作日"
  },
  {
    "word": "weekend",
    "phonetic": "[ˌwiːkˈend]",
    "meaning": "周末"
  },
  {
    "word": "weekly",
    "phonetic": "[ˈwiːkli]",
    "meaning": "每周的"
  },
  {
    "word": "weep",
    "phonetic": "[wiːp]",
    "meaning": "哭泣"
  },
  {
    "word": "weigh",
    "phonetic": "[weɪ]",
    "meaning": "称重"
  },
  {
    "word": "weight",
    "phonetic": "[weɪt]",
    "meaning": "重量"
  },
  {
    "word": "welcome",
    "phonetic": "[ˈwelkəm]",
    "meaning": "欢迎"
  },
  {
    "word": "welfare",
    "phonetic": "[ˈwelfeə(r)]",
    "meaning": "福利"
  },
  {
    "word": "well",
    "phonetic": "[wel]",
    "meaning": "好地"
  },
  {
    "word": "well-known",
    "phonetic": "[ˌwel ˈnəʊn]",
    "meaning": "著名的"
  },
  {
    "word": "west",
    "phonetic": "[west]",
    "meaning": "西方"
  },
  {
    "word": "western",
    "phonetic": "[ˈwestən]",
    "meaning": "西方的"
  },
  {
    "word": "wet",
    "phonetic": "[wet]",
    "meaning": "湿的"
  },
  {
    "word": "whale",
    "phonetic": "[weɪl]",
    "meaning": "鲸鱼"
  },
  {
    "word": "what",
    "phonetic": "[wɒt]",
    "meaning": "什么"
  },
  {
    "word": "whatever",
    "phonetic": "[wɒtˈevə(r)]",
    "meaning": "无论什么"
  },
  {
    "word": "wheat",
    "phonetic": "[wiːt]",
    "meaning": "小麦"
  },
  {
    "word": "wheel",
    "phonetic": "[wiːl]",
    "meaning": "轮子"
  },
  {
    "word": "when",
    "phonetic": "[wen]",
    "meaning": "什么时候"
  },
  {
    "word": "whenever",
    "phonetic": "[wenˈevə(r)]",
    "meaning": "无论何时"
  },
  {
    "word": "where",
    "phonetic": "[weə(r)]",
    "meaning": "哪里"
  },
  {
    "word": "whereas",
    "phonetic": "[ˌweərˈæz]",
    "meaning": "然而"
  },
  {
    "word": "wherever",
    "phonetic": "[weərˈevə(r)]",
    "meaning": "无论哪里"
  },
  {
    "word": "whether",
    "phonetic": "[ˈweðə(r)]",
    "meaning": "是否"
  },
  {
    "word": "which",
    "phonetic": "[wɪtʃ]",
    "meaning": "哪一个"
  },
  {
    "word": "whichever",
    "phonetic": "[wɪtʃˈevə(r)]",
    "meaning": "无论哪一个"
  },
  {
    "word": "while",
    "phonetic": "[waɪl]",
    "meaning": "当...时候"
  },
  {
    "word": "whisper",
    "phonetic": "[ˈwɪspə(r)]",
    "meaning": "耳语"
  },
  {
    "word": "white",
    "phonetic": "[waɪt]",
    "meaning": "白色"
  },
  {
    "word": "who",
    "phonetic": "[huː]",
    "meaning": "谁"
  },
  {
    "word": "whoever",
    "phonetic": "[huːˈevə(r)]",
    "meaning": "无论谁"
  },
  {
    "word": "whole",
    "phonetic": "[həʊl]",
    "meaning": "整个的"
  },
  {
    "word": "whom",
    "phonetic": "[huːm]",
    "meaning": "谁(宾格)"
  },
  {
    "word": "whose",
    "phonetic": "[huːz]",
    "meaning": "谁的"
  },
  {
    "word": "why",
    "phonetic": "[waɪ]",
    "meaning": "为什么"
  },
  {
    "word": "wicked",
    "phonetic": "[ˈwɪkɪd]",
    "meaning": "邪恶的"
  },
  {
    "word": "wide",
    "phonetic": "[waɪd]",
    "meaning": "宽的"
  },
  {
    "word": "widen",
    "phonetic": "[ˈwaɪdn]",
    "meaning": "加宽"
  },
  {
    "word": "widely",
    "phonetic": "[ˈwaɪdli]",
    "meaning": "广泛地"
  },
  {
    "word": "width",
    "phonetic": "[wɪdθ]",
    "meaning": "宽度"
  },
  {
    "word": "wife",
    "phonetic": "[waɪf]",
    "meaning": "妻子"
  },
  {
    "word": "wild",
    "phonetic": "[waɪld]",
    "meaning": "野生的"
  },
  {
    "word": "will",
    "phonetic": "[wɪl]",
    "meaning": "将要"
  },
  {
    "word": "willing",
    "phonetic": "[ˈwɪlɪŋ]",
    "meaning": "愿意的"
  },
  {
    "word": "willingly",
    "phonetic": "[ˈwɪlɪŋli]",
    "meaning": "愿意地"
  },
  {
    "word": "win",
    "phonetic": "[wɪn]",
    "meaning": "赢"
  },
  {
    "word": "wind",
    "phonetic": "[wɪnd]",
    "meaning": "风"
  },
  {
    "word": "window",
    "phonetic": "[ˈwɪndəʊ]",
    "meaning": "窗户"
  },
  {
    "word": "wine",
    "phonetic": "[waɪn]",
    "meaning": "葡萄酒"
  },
  {
    "word": "wing",
    "phonetic": "[wɪŋ]",
    "meaning": "翅膀"
  },
  {
    "word": "winner",
    "phonetic": "[ˈwɪnə(r)]",
    "meaning": "获胜者"
  },
  {
    "word": "winter",
    "phonetic": "[ˈwɪntə(r)]",
    "meaning": "冬天"
  },
  {
    "word": "wipe",
    "phonetic": "[waɪp]",
    "meaning": "擦"
  },
  {
    "word": "wire",
    "phonetic": "[waɪə(r)]",
    "meaning": "电线"
  },
  {
    "word": "wise",
    "phonetic": "[waɪz]",
    "meaning": "明智的"
  },
  {
    "word": "wisdom",
    "phonetic": "[ˈwɪzdəm]",
    "meaning": "智慧"
  },
  {
    "word": "wish",
    "phonetic": "[wɪʃ]",
    "meaning": "希望"
  },
  {
    "word": "with",
    "phonetic": "[wɪð]",
    "meaning": "和"
  },
  {
    "word": "within",
    "phonetic": "[wɪˈðɪn]",
    "meaning": "在...之内"
  },
  {
    "word": "without",
    "phonetic": "[wɪˈðaʊt]",
    "meaning": "没有"
  },
  {
    "word": "withstand",
    "phonetic": "[wɪðˈstænd]",
    "meaning": "承受"
  },
  {
    "word": "witness",
    "phonetic": "[ˈwɪtnəs]",
    "meaning": "证人"
  },
  {
    "word": "woman",
    "phonetic": "[ˈwʊmən]",
    "meaning": "女人"
  },
  {
    "word": "women",
    "phonetic": "[ˈwɪmɪn]",
    "meaning": "女人(复数)"
  },
  {
    "word": "wonder",
    "phonetic": "[ˈwʌndə(r)]",
    "meaning": "想知道"
  },
  {
    "word": "wonderful",
    "phonetic": "[ˈwʌndəfl]",
    "meaning": "精彩的"
  },
  {
    "word": "wood",
    "phonetic": "[wʊd]",
    "meaning": "木头"
  },
  {
    "word": "wooden",
    "phonetic": "[ˈwʊdn]",
    "meaning": "木制的"
  },
  {
    "word": "wool",
    "phonetic": "[wʊl]",
    "meaning": "羊毛"
  },
  {
    "word": "woollen",
    "phonetic": "[ˈwʊlən]",
    "meaning": "羊毛的"
  },
  {
    "word": "word",
    "phonetic": "[wɜːd]",
    "meaning": "单词"
  },
  {
    "word": "work",
    "phonetic": "[wɜːk]",
    "meaning": "工作"
  },
  {
    "word": "worker",
    "phonetic": "[ˈwɜːkə(r)]",
    "meaning": "工人"
  },
  {
    "word": "workplace",
    "phonetic": "[ˈwɜːkpleɪs]",
    "meaning": "工作场所"
  },
  {
    "word": "works",
    "phonetic": "[wɜːks]",
    "meaning": "作品"
  },
  {
    "word": "world",
    "phonetic": "[wɜːld]",
    "meaning": "世界"
  },
  {
    "word": "worldwide",
    "phonetic": "[ˈwɜːldwaɪd]",
    "meaning": "全世界的"
  },
  {
    "word": "worm",
    "phonetic": "[wɜːm]",
    "meaning": "虫子"
  },
  {
    "word": "worry",
    "phonetic": "[ˈwʌri]",
    "meaning": "担心"
  },
  {
    "word": "worried",
    "phonetic": "[ˈwʌrid]",
    "meaning": "担心的"
  },
  {
    "word": "worse",
    "phonetic": "[wɜːs]",
    "meaning": "更糟的"
  },
  {
    "word": "worship",
    "phonetic": "[ˈwɜːʃɪp]",
    "meaning": "崇拜"
  },
  {
    "word": "worst",
    "phonetic": "[wɜːst]",
    "meaning": "最坏的"
  },
  {
    "word": "worth",
    "phonetic": "[wɜːθ]",
    "meaning": "值得"
  },
  {
    "word": "worthwhile",
    "phonetic": "[ˌwɜːθˈwaɪl]",
    "meaning": "值得的"
  },
  {
    "word": "worthy",
    "phonetic": "[ˈwɜːði]",
    "meaning": "值得的"
  },
  {
    "word": "would",
    "phonetic": "[wʊd]",
    "meaning": "将"
  },
  {
    "word": "wound",
    "phonetic": "[wuːnd]",
    "meaning": "伤口"
  },
  {
    "word": "wrap",
    "phonetic": "[ræp]",
    "meaning": "包裹"
  },
  {
    "word": "wrapping",
    "phonetic": "[ˈræpɪŋ]",
    "meaning": "包装材料"
  },
  {
    "word": "wreck",
    "phonetic": "[rek]",
    "meaning": "残骸"
  },
  {
    "word": "wrestle",
    "phonetic": "[ˈresl]",
    "meaning": "摔跤"
  },
  {
    "word": "wretched",
    "phonetic": "[ˈretʃɪd]",
    "meaning": "可怜的"
  },
  {
    "word": "wrinkle",
    "phonetic": "[ˈrɪŋkl]",
    "meaning": "皱纹"
  },
  {
    "word": "wrist",
    "phonetic": "[rɪst]",
    "meaning": "手腕"
  },
  {
    "word": "write",
    "phonetic": "[raɪt]",
    "meaning": "写"
  },
  {
    "word": "writer",
    "phonetic": "[ˈraɪtə(r)]",
    "meaning": "作家"
  },
  {
    "word": "writing",
    "phonetic": "[ˈraɪtɪŋ]",
    "meaning": "写作"
  },
  {
    "word": "wrong",
    "phonetic": "[rɒŋ]",
    "meaning": "错误的"
  },
  {
    "word": "wrote",
    "phonetic": "[rəʊt]",
    "meaning": "写(过去式)"
  },
  {
    "word": "X-ray",
    "phonetic": "[ˈeks reɪ]",
    "meaning": "X光"
  },
  {
    "word": "yard",
    "phonetic": "[jɑːd]",
    "meaning": "院子"
  },
  {
    "word": "yawn",
    "phonetic": "[jɔːn]",
    "meaning": "打哈欠"
  },
  {
    "word": "year",
    "phonetic": "[jɪə(r)]",
    "meaning": "年"
  },
  {
    "word": "yearly",
    "phonetic": "[ˈjɪəli]",
    "meaning": "每年的"
  },
  {
    "word": "yellow",
    "phonetic": "[ˈjeləʊ]",
    "meaning": "黄色"
  },
  {
    "word": "yes",
    "phonetic": "[jes]",
    "meaning": "是的"
  },
  {
    "word": "yesterday",
    "phonetic": "[ˈjestədeɪ]",
    "meaning": "昨天"
  },
  {
    "word": "yet",
    "phonetic": "[jet]",
    "meaning": "还"
  },
  {
    "word": "yield",
    "phonetic": "[jiːld]",
    "meaning": "产量"
  },
  {
    "word": "you",
    "phonetic": "[juː]",
    "meaning": "你"
  },
  {
    "word": "young",
    "phonetic": "[jʌŋ]",
    "meaning": "年轻的"
  },
  {
    "word": "your",
    "phonetic": "[jɔː(r)]",
    "meaning": "你的"
  },
  {
    "word": "yours",
    "phonetic": "[jɔːz]",
    "meaning": "你的"
  },
  {
    "word": "yourself",
    "phonetic": "[jɔːˈself]",
    "meaning": "你自己"
  },
  {
    "word": "yourselves",
    "phonetic": "[jɔːˈselvz]",
    "meaning": "你们自己"
  },
  {
    "word": "youth",
    "phonetic": "[juːθ]",
    "meaning": "青年"
  },
  {
    "word": "youthful",
    "phonetic": "[ˈjuːθfl]",
    "meaning": "年轻的"
  },
  {
    "word": "zero",
    "phonetic": "[ˈzɪərəʊ]",
    "meaning": "零"
  },
  {
    "word": "zinc",
    "phonetic": "[zɪŋk]",
    "meaning": "锌"
  },
  {
    "word": "zip",
    "phonetic": "[zɪp]",
    "meaning": "拉链"
  },
  {
    "word": "zip code",
    "phonetic": "[ˌzɪp ˈkəʊd]",
    "meaning": "邮政编码"
  },
  {
    "word": "zone",
    "phonetic": "[zəʊn]",
    "meaning": "区域"
  },
  {
    "word": "zoo",
    "phonetic": "[zuː]",
    "meaning": "动物园"
  },
  {
    "word": "zoom",
    "phonetic": "[zuːm]",
    "meaning": "放大"
  },
  {
    "word": "academy",
    "phonetic": "[əˈkædəmi]",
    "meaning": "学院"
  },
  {
    "word": "access",
    "phonetic": "[ˈækses]",
    "meaning": "进入"
  },
  {
    "word": "accessible",
    "phonetic": "[əkˈsesəbl]",
    "meaning": "可接近的"
  },
  {
    "word": "accommodate",
    "phonetic": "[əˈkɒmədeɪt]",
    "meaning": "容纳"
  },
  {
    "word": "accommodation",
    "phonetic": "[əˌkɒməˈdeɪʃn]",
    "meaning": "住宿"
  },
  {
    "word": "accompany",
    "phonetic": "[əˈkʌmpəni]",
    "meaning": "陪伴"
  },
  {
    "word": "according to",
    "phonetic": "[əˈkɔːdɪŋ tuː]",
    "meaning": "根据"
  },
  {
    "word": "account",
    "phonetic": "[əˈkaʊnt]",
    "meaning": "账户"
  },
  {
    "word": "accountant",
    "phonetic": "[əˈkaʊntənt]",
    "meaning": "会计"
  },
  {
    "word": "accumulate",
    "phonetic": "[əˈkjuːmjəleɪt]",
    "meaning": "积累"
  },
  {
    "word": "accuracy",
    "phonetic": "[ˈækjərəsi]",
    "meaning": "准确性"
  },
  {
    "word": "accuse",
    "phonetic": "[əˈkjuːz]",
    "meaning": "指控"
  },
  {
    "word": "achieve",
    "phonetic": "[əˈtʃiːv]",
    "meaning": "实现"
  },
  {
    "word": "achievement",
    "phonetic": "[əˈtʃiːvmənt]",
    "meaning": "成就"
  },
  {
    "word": "acquisition",
    "phonetic": "[ˌækwɪˈzɪʃn]",
    "meaning": "获得"
  },
  {
    "word": "acre",
    "phonetic": "[ˈeɪkə(r)]",
    "meaning": "英亩"
  },
  {
    "word": "across",
    "phonetic": "[əˈkrɒs]",
    "meaning": "穿过"
  },
  {
    "word": "act",
    "phonetic": "[ækt]",
    "meaning": "行动"
  },
  {
    "word": "action",
    "phonetic": "[ˈækʃn]",
    "meaning": "行动"
  },
  {
    "word": "active",
    "phonetic": "[ˈæktɪv]",
    "meaning": "活跃的"
  },
  {
    "word": "activity",
    "phonetic": "[ækˈtɪvəti]",
    "meaning": "活动"
  }
];

module.exports = seniorRealWords;