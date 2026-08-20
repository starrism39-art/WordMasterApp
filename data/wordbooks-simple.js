// 简化版词书数据，直接导出所有词书，避免分包导入问题

// 云端词书加载器（用于减少主包体积）
const cloudWordbookLoader = require('../utils/cloud-wordbook-loader.js');

// 小学词书
const primaryWordbooks = [
  {
    "id": "primary_textbook_real",
    "title": "小学统编版英语词书",
    "description": "基于真实小学英语教材的词汇表，包含567个核心单词",
    "category": "primary",
    "grade": "primary",
    "region": "全国",
    "version": "统编版",
    "totalWords": 567,
    "words": [
      { "word": "hello", "phonetic": "/həˈləʊ/", "meaning": "你好" },
      { "word": "world", "phonetic": "/wɜːld/", "meaning": "世界" },
      { "word": "good", "phonetic": "/ɡʊd/", "meaning": "好的" },
      { "word": "morning", "phonetic": "/ˈmɔːnɪŋ/", "meaning": "早晨" },
      { "word": "afternoon", "phonetic": "/ˌɑːftəˈnuːn/", "meaning": "下午" }
    ]
  }
];

// 初中词书
const juniorWordbooks = [
  {
    "id": "junior_exam_words",
    "title": "初中中考词汇",
    "description": "基于初中中考要求的英语核心词汇，包含1615个必备单词",
    "category": "junior",
    "grade": "junior",
    "region": "全国",
    "version": "中考",
    "totalWords": 1615,
    "words": [
      { "word": "a(an)", "phonetic": "ə, eɪ(ən)", "meaning": "一（个、件……）" },
      { "word": "ability", "phonetic": "əˈbɪlɪtɪ", "meaning": "能力；才能" },
      { "word": "able", "phonetic": "ˈeɪb(ə)l", "meaning": "能够；有能力的" }
    ]
  },
  {
    "id": "junior_7th_textbook",
    "title": "外研社七年级上册",
    "description": "基于外研社七年级上册英语教材的词汇表，包含288个核心单词",
    "category": "junior",
    "grade": "7th",
    "region": "全国",
    "version": "外研社",
    "totalWords": 288,
    "words": [
      { "word": "hello", "phonetic": "/həˈləʊ/", "meaning": "你好" },
      { "word": "hi", "phonetic": "/haɪ/", "meaning": "嗨" },
      { "word": "goodbye", "phonetic": "/ˌɡʊdˈbaɪ/", "meaning": "再见" },
      { "word": "bye", "phonetic": "/baɪ/", "meaning": "再见" },
      { "word": "morning", "phonetic": "/ˈmɔːnɪŋ/", "meaning": "早晨" }
    ]
  },
  {
    "id": "junior_7th_second",
    "title": "外研社七年级下册",
    "description": "基于外研社七年级下册英语教材的词汇表，包含368个核心单词",
    "category": "junior",
    "grade": "7th",
    "region": "全国",
    "version": "外研社",
    "totalWords": 368,
    "words": [
      { "word": "review", "phonetic": "/rɪˈvjuː/", "meaning": "复习" },
      { "word": "chocolate", "phonetic": "/ˈtʃɒklət/", "meaning": "巧克力" },
      { "word": "factory", "phonetic": "/ˈfæktri/", "meaning": "工厂" },
      { "word": "exciting", "phonetic": "/ɪkˈsaɪtɪŋ/", "meaning": "令人兴奋的" },
      { "word": "marathon", "phonetic": "/ˈmærəθən/", "meaning": "马拉松" }
    ]
  },
  {
    "id": "junior_8th_first",
    "title": "外研社八年级上册",
    "description": "基于外研社八年级上册英语教材的词汇表，包含243个核心单词",
    "category": "junior",
    "grade": "8th",
    "region": "全国",
    "version": "外研社",
    "totalWords": 243,
    "words": [
      { "word": "review", "phonetic": "/rɪˈvjuː/", "meaning": "复习" },
      { "word": "suppose", "phonetic": "/səˈpəʊz/", "meaning": "假设，认为" },
      { "word": "birthmark", "phonetic": "/ˈbɜːθmɑːk/", "meaning": "胎记" },
      { "word": "bright", "phonetic": "/braɪt/", "meaning": "明亮的，聪明的" },
      { "word": "strawberry", "phonetic": "/ˈstrɔːbəri/", "meaning": "草莓" }
    ]
  },
  {
    "id": "junior_8th_second",
    "title": "外研社八年级下册",
    "description": "基于外研社八年级下册英语教材的词汇表，包含212个核心单词",
    "category": "junior",
    "grade": "8th",
    "region": "全国",
    "version": "外研社",
    "totalWords": 212,
    "words": [
      { "word": "spiderman", "phonetic": "/ˈspaɪdəmæn/", "meaning": "蜘蛛人（指高空作业人员）" },
      { "word": "wet", "phonetic": "/wet/", "meaning": "湿的；潮的；潮湿的" },
      { "word": "watermelon", "phonetic": "/ˈwɔːtəmelən/", "meaning": "西瓜" },
      { "word": "remind", "phonetic": "/rɪˈmaɪnd/", "meaning": "使想起（故人或旧事）" },
      { "word": "interview", "phonetic": "/ˈɪntəvjuː/", "meaning": "面试；面谈" }
    ]
  },
  {
    "id": "junior_9th_first",
    "title": "外研社九年级上册",
    "description": "基于外研社九年级上册英语教材的词汇表，包含335个核心单词",
    "category": "junior",
    "grade": "9th",
    "region": "全国",
    "version": "外研社",
    "totalWords": 335,
    "words": [
      { "word": "man-made", "phonetic": "/ˌmænˈmeɪd/", "meaning": "人造的" },
      { "word": "natural", "phonetic": "/ˈnætʃrəl/", "meaning": "大自然的" },
      { "word": "wonder", "phonetic": "/ˈwʌndə(r)/", "meaning": "奇观；奇迹" },
      { "word": "discussion", "phonetic": "/dɪˈskʌʃn/", "meaning": "讨论；商讨" },
      { "word": "eastern", "phonetic": "/ˈiːstən/", "meaning": "在东边的；来自东边的" }
    ]
  },
  {
    "id": "junior_9th_second",
    "title": "外研社九年级下册",
    "description": "基于外研社九年级下册英语教材的词汇表，包含103个核心单词",
    "category": "junior",
    "grade": "9th",
    "region": "全国",
    "version": "外研社",
    "totalWords": 103,
    "words": [
      { "word": "flight", "phonetic": "/flaɪt/", "meaning": "航班；飞行" },
      { "word": "direct", "phonetic": "/dɪˈrekt, daɪˈrekt/", "meaning": "径直地；直接地" },
      { "word": "pilot", "phonetic": "/ˈpaɪlət/", "meaning": "飞行员" },
      { "word": "succeed", "phonetic": "/səkˈsiːd/", "meaning": "成功；做成" },
      { "word": "exactly", "phonetic": "/ɪɡˈzæktli/", "meaning": "确切地；完全；[口] (表示赞同) 确实如此" }
    ]
  },
  {
    "id": "junior_7th_ji",
    "title": "冀教版七年级上册",
    "description": "基于冀教版七年级上册英语教材的词汇表，包含296个核心单词",
    "category": "junior",
    "grade": "7th",
    "region": "全国",
    "version": "冀教版",
    "totalWords": 296,
    "words": [
      { "word": "same", "phonetic": "/seɪm/", "meaning": "相同的；同一的" },
      { "word": "everyone", "phonetic": "/ˈevriwʌn/", "meaning": "每人；人人" },
      { "word": "around", "phonetic": "/əˈraʊnd/", "meaning": "在……周围；环绕" },
      { "word": "building", "phonetic": "/ˈbɪldɪŋ/", "meaning": "建筑物；楼房" },
      { "word": "borrow", "phonetic": "/ˈbɒrəʊ/", "meaning": "借；借用" }
    ]
  },
  {
    "id": "junior_7th_ji_second",
    "title": "冀教版七年级下册",
    "description": "基于冀教版七年级下册英语教材的词汇表，包含208个核心单词",
    "category": "junior",
    "grade": "7th",
    "region": "全国",
    "version": "冀教版",
    "totalWords": 208,
    "words": [
      { "word": "silk", "phonetic": "/sɪlk/", "meaning": "丝绸；（蚕）丝" },
      { "word": "term", "phonetic": "/tɜːm/", "meaning": "学期；术语" },
      { "word": "along", "phonetic": "/əˈlɒŋ/", "meaning": "沿着；顺着" },
      { "word": "lead", "phonetic": "/liːd/", "meaning": "领路；导致" },
      { "word": "trip", "phonetic": "/trɪp/", "meaning": "旅行" }
    ]
  },
  {
    "id": "junior_8th_ji_first",
    "title": "冀教版八年级上册",
    "description": "基于冀教版八年级上册英语教材的词汇表，包含425个核心单词",
    "category": "junior",
    "grade": "8th",
    "region": "全国",
    "version": "冀教版",
    "totalWords": 425,
    "words": [
      { "word": "chat", "phonetic": "/tʃæt/", "meaning": "聊天；闲谈" },
      { "word": "online", "phonetic": "/ˌɒnˈlaɪn/", "meaning": "在线的；联网的" },
      { "word": "communication", "phonetic": "/kəˌmjuːnɪˈkeɪʃn/", "meaning": "交流；沟通" },
      { "word": "skill", "phonetic": "/skɪl/", "meaning": "技能；技巧" },
      { "word": "develop", "phonetic": "/dɪˈveləp/", "meaning": "发展；培养" }
    ]
  },
  {
    "id": "junior_8th_ji_second",
    "title": "冀教版八年级下册",
    "description": "基于冀教版八年级下册英语教材的词汇表，包含429个核心单词",
    "category": "junior",
    "grade": "8th",
    "region": "全国",
    "version": "冀教版",
    "totalWords": 429,
    "words": [
      { "word": "wheel", "phonetic": "/wiːl/", "meaning": "轮子；车轮；方向盘" },
      { "word": "wagon", "phonetic": "/ˈwæɡən/", "meaning": "四轮载重马车（或牛车）；小推车" },
      { "word": "power", "phonetic": "/ˈpaʊə(r)/", "meaning": "能力；权力；电力" },
      { "word": "compass", "phonetic": "/ˈkʌmpəs/", "meaning": "指南针；罗盘" },
      { "word": "canal", "phonetic": "/kəˈnæl/", "meaning": "运河；灌溉渠" }
    ]
  },
  {
    "id": "junior_9th_ji",
    "title": "冀教版九年级全一册",
    "description": "基于冀教版九年级全一册英语教材的词汇表，包含434个核心单词",
    "category": "junior",
    "grade": "9th",
    "region": "全国",
    "version": "冀教版",
    "totalWords": 434,
    "words": [
      { "word": "stomach", "phonetic": "/ˈstʌmək/", "meaning": "胃；腹部" },
      { "word": "regret", "phonetic": "/rɪˈɡret/", "meaning": "惋惜；懊悔" },
      { "word": "fever", "phonetic": "/ˈfiːvə(r)/", "meaning": "发烧；发热" },
      { "word": "pale", "phonetic": "/peɪl/", "meaning": "苍白的；浅色的" },
      { "word": "examination", "phonetic": "/ɪɡˌzæmɪˈneɪʃn/", "meaning": "检查；考试" }
    ]
  },
  {
    "id": "junior_7th_yi_lin",
    "title": "译林牛津版七年级上册",
    "description": "基于译林牛津版七年级上册英语教材的词汇表",
    "category": "junior",
    "grade": "7th",
    "region": "全国",
    "version": "译林牛津版",
    "totalWords": 478,
    "words": [
      { "word": "welcome", "phonetic": "/ˈwelkəm/", "meaning": "欢迎" },
      { "word": "to", "phonetic": "/tuː/", "meaning": "到，向，朝" },
      { "word": "China", "phonetic": "/ˈtʃaɪnə/", "meaning": "中国" },
      { "word": "thank", "phonetic": "/θæŋk/", "meaning": "谢谢" },
      { "word": "you", "phonetic": "/juː/", "meaning": "你，你们" }
    ]
  },
  {
    "id": "junior_7th_ren_jiao",
    "title": "人教版七年级上册",
    "description": "基于人教版七年级上册英语教材的词汇表，包含421个核心单词",
    "category": "junior",
    "grade": "7th",
    "region": "全国",
    "version": "人教版",
    "totalWords": 421,
    "words": [
      { "word": "get up", "phonetic": "/ɡet ʌp/", "meaning": "起床" },
      { "word": "rise", "phonetic": "/raɪz/", "meaning": "v. 起床；升起；增长 n. 增加；隆起" },
      { "word": "stay", "phonetic": "/steɪ/", "meaning": "v.&n. 停留；待" },
      { "word": "around", "phonetic": "/əˈraʊnd/", "meaning": "adv.&prep. 大约；环绕；在……周围" },
      { "word": "reporter", "phonetic": "/rɪˈpɔːtə(r)/", "meaning": "n. 记者" }
    ]
  },
  {
    "id": "junior_7th_ren_jiao_second",
    "title": "人教版七年级下册",
    "description": "基于人教版七年级下册英语教材的词汇表，包含276个核心单词",
    "category": "junior",
    "grade": "7th",
    "region": "全国",
    "version": "人教版",
    "totalWords": 276,
    "words": [
      { "word": "fox", "phonetic": "/fɒks/", "meaning": "n. 狐狸" },
      { "word": "giraffe", "phonetic": "/dʒəˈrɑːf/", "meaning": "n. 长颈鹿" },
      { "word": "eagle", "phonetic": "/ˈiːɡl/", "meaning": "n. 雕；鹰" },
      { "word": "wolf", "phonetic": "/wʊlf/", "meaning": "n. (pl. wolves /wʊlvz/) 狼" },
      { "word": "penguin", "phonetic": "/ˈpeŋɡwɪn/", "meaning": "n. 企鹅" }
    ]
  },
  {
    "id": "junior_8th_ren_jiao",
    "title": "人教版八年级上册",
    "description": "基于人教版八年级上册英语教材的词汇表，包含400个核心单词",
    "category": "junior",
    "grade": "8th",
    "region": "全国",
    "version": "人教版",
    "totalWords": 392,
    "words": [
      { "word": "ancient", "phonetic": "/ˈeɪnʃənt/", "meaning": "古代的；古老的" },
      { "word": "camp", "phonetic": "/kæmp/", "meaning": "度假营；营地" },
      { "word": "landscape", "phonetic": "/ˈlænskeɪp/", "meaning": "风景；景色" },
      { "word": "strange", "phonetic": "/streɪndʒ/", "meaning": "奇怪的；陌生的" },
      { "word": "vacation", "phonetic": "/vəˈkeɪʃn/", "meaning": "假期；度假" }
    ]
  },
  {
    "id": "junior_8th_ren_jiao_second",
    "title": "人教版八年级下册",
    "description": "基于人教版八年级下册英语教材的词汇表，包含280个核心单词",
    "category": "junior",
    "grade": "8th",
    "region": "全国",
    "version": "人教版",
    "totalWords": 280,
    "words": [
      { "word": "calligraphy", "phonetic": "/kəˈlɪɡrəfi/", "meaning": "书法" },
      { "word": "skill", "phonetic": "/skɪl/", "meaning": "技能" },
      { "word": "programmer", "phonetic": "/ˈprəʊɡræmə(r)/", "meaning": "编写程序的人；程序员" },
      { "word": "expression", "phonetic": "/ɪkˈspreʃn/", "meaning": "表示" },
      { "word": "instructor", "phonetic": "/ɪnˈstrʌktə(r)/", "meaning": "教练；指导者" }
    ]
  },
  {
    "id": "junior_9th_ren_jiao",
    "title": "人教版九年级全一册",
    "description": "基于人教版九年级全一册英语教材的词汇表，包含164个核心单词",
    "category": "junior",
    "grade": "9th",
    "region": "全国",
    "version": "人教版",
    "totalWords": 164,
    "words": [
      { "word": "textbook", "phonetic": "/ˈtekstbʊk/", "meaning": "教科书；课本" },
      { "word": "conversation", "phonetic": "/ˌkɒnvəˈseɪʃn/", "meaning": "交谈；谈话" },
      { "word": "aloud", "phonetic": "/əˈlaʊd/", "meaning": "大声地；出声地" },
      { "word": "pronunciation", "phonetic": "/prəˌnʌnsiˈeɪʃn/", "meaning": "发音；读音" },
      { "word": "sentence", "phonetic": "/ˈsentəns/", "meaning": "句子" }
    ]
  },
  // ===== 人教版初中重录版（v2）=====
  {
    "id": "junior_7th_ren_jiao_v2",
    "title": "人教版七年级上册（重录版）",
    "description": "重新录入的人教版七年级上册英语词汇表，按单元排列",
    "category": "junior",
    "grade": "7th",
    "region": "全国",
    "version": "人教版",
    "totalWords": 263,
    "words": []
  },
  {
    "id": "junior_7th_ren_jiao_second_v2",
    "title": "人教版七年级下册（重录版）",
    "description": "重新录入的人教版七年级下册英语词汇表，按单元排列",
    "category": "junior",
    "grade": "7th",
    "region": "全国",
    "version": "人教版",
    "totalWords": 451,
    "words": []
  },
  {
    "id": "junior_8th_ren_jiao_v2",
    "title": "人教版八年级上册（重录版）",
    "description": "重新录入的人教版八年级上册英语词汇表，按单元排列",
    "category": "junior",
    "grade": "8th",
    "region": "全国",
    "version": "人教版",
    "totalWords": 525,
    "words": []
  },
  {
    "id": "junior_8th_ren_jiao_second_v2",
    "title": "人教版八年级下册（重录版）",
    "description": "重新录入的人教版八年级下册英语词汇表，按单元排列",
    "category": "junior",
    "grade": "8th",
    "region": "全国",
    "version": "人教版",
    "totalWords": 573,
    "words": []
  },
  {
    "id": "junior_9th_ren_jiao_v2",
    "title": "人教版九年级全一册（重录版）",
    "description": "重新录入的人教版九年级全一册英语词汇表，按单元排列",
    "category": "junior",
    "grade": "9th",
    "region": "全国",
    "version": "人教版",
    "totalWords": 604,
    "words": []
  },
  {
    "id": "junior_7th_yi_lin_second",
    "title": "译林牛津版七年级下册",
    "description": "基于译林牛津版七年级下册英语教材的词汇表",
    "category": "junior",
    "grade": "7th",
    "region": "全国",
    "version": "译林牛津版",
    "totalWords": 300,
    "words": [
      { "word": "dream", "phonetic": "/driːm/", "meaning": "梦想；梦" },
      { "word": "palace", "phonetic": "/ˈpæləs/", "meaning": "宫殿" },
      { "word": "capital", "phonetic": "/ˈkæpɪtl/", "meaning": "首都" },
      { "word": "France", "phonetic": "/frɑːns/", "meaning": "法国" },
      { "word": "French", "phonetic": "/frentʃ/", "meaning": "法语；法国的" }
    ]
  },
  {
    "id": "junior_8th_yi_lin_first",
    "title": "译林牛津版八年级上册",
    "description": "基于译林牛津版八年级上册英语教材的词汇表",
    "category": "junior",
    "grade": "8th",
    "region": "全国",
    "version": "译林牛津版",
    "totalWords": 400,
    "words": [
      { "word": "almost", "phonetic": "/ˈɔːlməʊst/", "meaning": "几乎，差不多" },
      { "word": "along", "phonetic": "/əˈlɒŋ/", "meaning": "沿着，顺着" },
      { "word": "amazing", "phonetic": "/əˈmeɪzɪŋ/", "meaning": "令人吃惊的，惊人的" },
      { "word": "anytime", "phonetic": "/ˈeniˌtaɪm/", "meaning": "在任何时候" },
      { "word": "anything", "phonetic": "/ˈeniθɪŋ/", "meaning": "任何事，任何东西" }
    ]
  },
  {
    "id": "junior_8th_yi_lin_second",
    "title": "译林牛津版八年级下册",
    "description": "基于译林牛津版八年级下册英语教材的词汇表",
    "category": "junior",
    "grade": "8th",
    "region": "全国",
    "version": "译林牛津版",
    "totalWords": 490,
    "words": [
      { "word": "past", "phonetic": "/pɑːst/", "meaning": "n. 过去" },
      { "word": "present", "phonetic": "/ˈpreznt/", "meaning": "n. 现在，目前" },
      { "word": "just", "phonetic": "/dʒʌst/", "meaning": "adv. 刚才" },
      { "word": "used to", "phonetic": "/juːzd tuː/", "meaning": "（用于过去持续或经常发生的事）曾经" },
      { "word": "since", "phonetic": "/sɪns/", "meaning": "conj. 自…以来" }
    ]
  },
  {
    "id": "junior_9th_yi_lin_first",
    "title": "译林牛津版九年级上册",
    "description": "基于译林牛津版九年级上册英语教材的词汇表",
    "category": "junior",
    "grade": "9th",
    "region": "全国",
    "version": "译林牛津版",
    "totalWords": 259,
    "words": [
      { "word": "murder", "phonetic": "/ˈmɜːdə(r)/", "meaning": "vt. 谋杀，杀害" },
      { "word": "suspect", "phonetic": "/ˈsʌspekt/", "meaning": "n. 犯罪嫌疑人" },
      { "word": "medium", "phonetic": "/ˈmiːdiəm/", "meaning": "adj. 中等的" },
      { "word": "untidy", "phonetic": "/ʌnˈtaɪdi/", "meaning": "adj. 不整洁的" },
      { "word": "guilty", "phonetic": "/ˈɡɪlti/", "meaning": "adj. 有罪的" }
    ]
  },
  {
    "id": "junior_9th_yi_lin_second",
    "title": "译林牛津版九年级下册",
    "description": "基于译林牛津版九年级下册英语教材的词汇表",
    "category": "junior",
    "grade": "9th",
    "region": "全国",
    "version": "译林牛津版",
    "totalWords": 124,
    "words": [
      { "word": "reality", "phonetic": "/rɪ'æləti/", "meaning": "现实，实际情况" },
      { "word": "suggest", "phonetic": "/sə'dʒest/", "meaning": "建议，提议" },
      { "word": "doubt", "phonetic": "/daʊt/", "meaning": "怀疑，疑惑" },
      { "word": "power", "phonetic": "/'paʊə(r)/", "meaning": "力量，能力" },
      { "word": "discovery", "phonetic": "/dɪ'skʌvəri/", "meaning": "发现" }
    ]
  }
];

// 高中词书
const seniorWordbooks = [
  {
    "id": "senior_textbook_real",
    "title": "高中统编版英语词书",
    "description": "基于真实高中英语教材的词汇表，包含4292个核心单词",
    "category": "senior",
    "grade": "senior",
    "region": "全国",
    "version": "统编版",
    "totalWords": 4292,
    "words": [
      { "word": "abandon", "phonetic": "/əˈbændən/", "meaning": "放弃，抛弃" },
      { "word": "absolute", "phonetic": "/ˈæbsəluːt/", "meaning": "绝对的" },
      { "word": "abstract", "phonetic": "/ˈæbstrækt/", "meaning": "抽象的" },
      { "word": "academic", "phonetic": "/ˌækəˈdemɪk/", "meaning": "学术的" },
      { "word": "accelerate", "phonetic": "/əkˈseləreɪt/", "meaning": "加速" }
    ]
  },
  {
    "id": "new_curriculum_senior",
    "title": "新课标高中英语词汇",
    "description": "基于新课标要求的高中英语核心词汇，包含3815个必备单词",
    "category": "senior",
    "grade": "senior",
    "region": "全国",
    "version": "新课标",
    "totalWords": 3815,
    "words": [
      { "word": "a (an)", "phonetic": "ə, eɪ(ən)", "meaning": "一（个、件……）" },
      { "word": "abandon", "phonetic": "əˈbændən", "meaning": "抛弃，舍弃，放弃" },
      { "word": "ability", "phonetic": "əˈbɪlɪtɪ", "meaning": "能力；才能" }
    ]
  },
  {
    "id": "gaokao_reading_words",
    "title": "高考英语阅读高频词汇",
    "description": "基于高考英语阅读要求的高频词汇，包含687个必备单词",
    "category": "senior",
    "grade": "senior",
    "region": "全国",
    "version": "高考",
    "totalWords": 687,
    "words": [
      { "word": "alter", "phonetic": "ˈɔːltə(r)", "meaning": "改变,改动,变更" },
      { "word": "burst", "phonetic": "bɜːst", "meaning": "突然发生,爆裂" },
      { "word": "dispose", "phonetic": "dɪˈspəʊz", "meaning": "除掉；处置；解决；处理(of)" },
      { "word": "absolute", "phonetic": "ˈæbsəluːt", "meaning": "绝对的,无条件的；完全的" },
      { "word": "abundant", "phonetic": "əˈbʌndənt", "meaning": "丰富的,充裕的,大量的" },
      { "word": "abuse", "phonetic": "əˈbjuːs", "meaning": "滥用,虐待；谩骂" },
      { "word": "academic", "phonetic": "ˌækəˈdemɪk", "meaning": "学术的；高等院校的；研究院的" },
      { "word": "academy", "phonetic": "əˈkædəmi", "meaning": "（高等）专科院校；学会" },
      { "word": "accelerate", "phonetic": "əkˈseləreɪt", "meaning": "加速,促进" },
      { "word": "accomplish", "phonetic": "əˈkʌmplɪʃ", "meaning": "完成,到达；实行" },
      { "word": "acid", "phonetic": "ˈæsɪd", "meaning": "酸,酸性物质 酸的；尖刻的" },
      { "word": "acknowledge", "phonetic": "əkˈnɒlɪdʒ", "meaning": "承认；致谢" },
      { "word": "acquire", "phonetic": "əˈkwaɪə(r)", "meaning": "取得,获得；学到" },
      { "word": "adapt", "phonetic": "əˈdæpt", "meaning": "适应,适合；改编,改写" },
      { "word": "adequate", "phonetic": "ˈædɪkwət", "meaning": "适当地；足够" },
      { "word": "adhere", "phonetic": "ədˈhɪə(r)", "meaning": "粘附,附着；遵守,坚持" },
      { "word": "adjust", "phonetic": "əˈdʒʌst", "meaning": "调整,调节" },
      { "word": "adopt", "phonetic": "əˈdɒpt", "meaning": "收养；采用；采纳" },
      { "word": "adult", "phonetic": "ˈædʌlt", "meaning": "成年人" },
      { "word": "advance", "phonetic": "ədˈvɑːns", "meaning": "前进,促进；提前" },
      { "word": "advantage", "phonetic": "ədˈvɑːntɪdʒ", "meaning": "优势,长处；利益" },
      { "word": "adventure", "phonetic": "ədˈventʃə(r)", "meaning": "冒险,奇遇" },
      { "word": "advice", "phonetic": "ədˈvaɪs", "meaning": "忠告,建议" },
      { "word": "affect", "phonetic": "əˈfekt", "meaning": "影响；感动" },
      { "word": "afford", "phonetic": "əˈfɔːd", "meaning": "负担得起；提供" },
      { "word": "agency", "phonetic": "ˈeɪdʒənsi", "meaning": "代理商,经销商" },
      { "word": "agent", "phonetic": "ˈeɪdʒənt", "meaning": "代理人,代理商；动因,原因" },
      { "word": "aggressive", "phonetic": "əˈɡresɪv", "meaning": "侵略的,好斗的；有进取心的" },
      { "word": "agriculture", "phonetic": "ˈæɡrɪkʌltʃə(r)", "meaning": "农业" },
      { "word": "aid", "phonetic": "eɪd", "meaning": "帮助,援助" }
    ]
  },
  {
    "id": "senior_exam_syllabus",
    "title": "高中考纲词",
    "description": "按原词书Round 1顺序整理的高中考纲词汇，共2950词",
    "category": "senior",
    "grade": "senior",
    "region": "全国",
    "version": "考纲",
    "totalWords": 2950,
    "words": [
      { "word": "education", "phonetic": "/ˌedʒ.uˈkeɪ.ʃən/", "meaning": "教育" },
      { "word": "school", "phonetic": "/skuːl/", "meaning": "学校" },
      { "word": "student", "phonetic": "/ˈstjuː.dənt/", "meaning": "学生" }
    ]
  },
  {
    "id": "senior_exam_syllabus_level_0",
    "title": "高中考纲词书（level0）",
    "description": "按原PDF中Round 1顺序整理，共1450词",
    "category": "senior",
    "grade": "senior",
    "region": "全国",
    "version": "考纲 level0",
    "totalWords": 1450,
    "words": [
      { "word": "education", "phonetic": "/ˌedʒ.uˈkeɪ.ʃən/", "meaning": "n. 教育" },
      { "word": "school", "phonetic": "/skuːl/", "meaning": "n. 学校" },
      { "word": "student", "phonetic": "/ˈstjuː.dənt/", "meaning": "n. 学生" }
    ]
  },
  {
    "id": "senior_exam_syllabus_level_1",
    "title": "高中考纲词书（level1）",
    "description": "按原PDF中Round 1顺序整理，共500词",
    "category": "senior",
    "grade": "senior",
    "region": "全国",
    "version": "考纲 level1",
    "totalWords": 500,
    "words": [
      { "word": "memory", "phonetic": "/ˈmeməri/", "meaning": "n. 记忆力；回忆" },
      { "word": "acquire", "phonetic": "/əˈkwaɪə(r)/", "meaning": "v. 获得，取得；学到" },
      { "word": "adapt", "phonetic": "/əˈdæpt/", "meaning": "v. 适应；改编" }
    ]
  },
  {
    "id": "senior_exam_syllabus_level_2",
    "title": "高中考纲词书（level2）",
    "description": "按原PDF中Round 1顺序整理，共1000词",
    "category": "senior",
    "grade": "senior",
    "region": "全国",
    "version": "考纲 level2",
    "totalWords": 1000,
    "words": [
      { "word": "analyse", "phonetic": "/ˈænəlaɪz/", "meaning": "v. 分析" },
      { "word": "assess", "phonetic": "/əˈses/", "meaning": "v. 评估" },
      { "word": "assign", "phonetic": "/əˈsaɪn/", "meaning": "v. 布置；分配" }
    ]
  },
  {
    "id": "senior_book_1_ren_jiao",
    "title": "高中必修一 (人教版)",
    "description": "基于人教版高中英语必修一的词汇表，包含365个核心单词",
    "category": "senior",
    "grade": "senior",
    "region": "全国",
    "version": "人教版",
    "totalWords": 365,
    "words": [
      { "word": "exchange", "phonetic": "/ɪksˈtʃeɪndʒ/", "meaning": "交换；交流；交易；兑换" },
      { "word": "lecture", "phonetic": "/ˈlektʃə(r)/", "meaning": "讲座；讲课；教训" },
      { "word": "registration", "phonetic": "/ˌredʒɪˈstreɪʃn/", "meaning": "登记；注册；挂号" },
      { "word": "register", "phonetic": "/ˈredʒɪstə(r)/", "meaning": "登记；注册" },
      { "word": "campus", "phonetic": "/ˈkæmpəs/", "meaning": "校园；校区" }
    ]
  },
  {
    "id": "senior_book_2_ren_jiao",
    "title": "高中必修二 (人教版)",
    "description": "基于人教版高中英语必修二的词汇表，包含378个核心单词",
    "category": "senior",
    "grade": "senior",
    "region": "全国",
    "version": "人教版",
    "totalWords": 378,
    "words": [
      { "word": "heritage", "phonetic": "/ˈherɪtɪdʒ/", "meaning": "遗产" },
      { "word": "creatively", "phonetic": "/kriˈeɪtɪvli/", "meaning": "创造性地" },
      { "word": "creative", "phonetic": "/kriˈeɪtɪv/", "meaning": "创造性的；有创造力的；有创意的" },
      { "word": "temple", "phonetic": "/ˈtempl/", "meaning": "庙；寺" },
      { "word": "relic", "phonetic": "/ˈrelɪk/", "meaning": "遗物；遗迹" }
    ]
  },
  {
    "id": "senior_book_3_ren_jiao",
    "title": "高中必修三 (人教版)",
    "description": "基于人教版高中英语必修三的词汇表，包含429个核心单词",
    "category": "senior",
    "grade": "senior",
    "region": "全国",
    "version": "人教版",
    "totalWords": 429,
    "words": [
      { "word": "lantern", "phonetic": "/ˈlæntən/", "meaning": "灯笼；提灯" },
      { "word": "carnival", "phonetic": "/ˈkɑːnɪvl/", "meaning": "狂欢节；嘉年华" },
      { "word": "costume", "phonetic": "/ˈkɒstjuːm/", "meaning": "(某地或某历史时期的)服装；戏装" },
      { "word": "march", "phonetic": "/mɑːtʃ/", "meaning": "行进；前进；示威游行" },
      { "word": "congratulation", "phonetic": "/kənˌɡrætʃuˈleɪʃn/", "meaning": "祝贺；恭喜" }
    ]
  }
];

function normalizeWordStem(word) {
  if (typeof word !== 'string') return '';
  const match = word.trim().toLowerCase().match(/[a-z]+/);
  return match ? match[0] : '';
}

function containsChinese(text) {
  return /[\u4e00-\u9fa5]/.test(text || '');
}

function sanitizeMergedMeaning(meaning, nextWord) {
  if (typeof meaning !== 'string') return meaning;
  let cleaned = meaning.replace(/\s+/g, ' ').trim();

  // 统一全角点号并清理开头噪声字符
  cleaned = cleaned
    .replace(/．/g, '.')
    .replace(/^[\]\[\/\s]+/, '');

  // 全局修复词性缩写OCR错误（不局限于字符串开头）
  cleaned = cleaned
    .replace(/\bd\.\s*onj\./gi, 'prep. conj.')
    .replace(/\bprep\.\s*onj\./gi, 'prep. conj.')
    .replace(/\bconj\.\s*rep\./gi, 'conj. prep.')
    .replace(/\bad\.\s*ron\./gi, 'adv. pron.')
    .replace(/\b(?:\.?\s*)ron\./gi, 'pron.')
    .replace(/\b(?:\.?\s*)rep\./gi, 'prep.')
    .replace(/\b(?:\.?\s*)onj\./gi, 'conj.')
    .replace(/\b(?:\.?\s*)dv\./gi, 'adv.')
    .replace(/\b(?:\.?\s*)odal\s*v\./gi, 'modal v.')
    .replace(/\b(?:\.?\s*)um\./gi, 'num.')
    .replace(/\b(?:\.?\s*)ink\.?\s*v\.?/gi, 'linking v.')
    .replace(/\b(?:\.?\s*)t\./gi, 'vt.')
    .replace(/\b(?:\.?\s*)i\./gi, 'vi.')
    // 统一词性标签间的连接格式
    .replace(/\b(vt|vi|adj|adv|prep|conj|pron|det|num|n|v)\.\s*(vt|vi|adj|adv|prep|conj|pron|det|num|n|v)\./gi, '$1., $2.')
    .replace(/\b(conj|prep|adv|pron|det|num)\.\s*(conj|prep|adv|pron|det|num)\./gi, '$1., $2.')
    // 修复词性标签与后文粘连（如 "由于prep.从……"）
    .replace(/([\u4e00-\u9fa5；;，,])\s*(prep\.|conj\.|adv\.|pron\.|det\.|num\.|adj\.|vt\.|vi\.|n\.|v\.)/gi, '$1 $2')
    .replace(/(prep\.|conj\.|adv\.|pron\.|det\.|num\.|adj\.|vt\.|vi\.|n\.|v\.)(?=[\u4e00-\u9fa5A-Za-z])/g, '$1 ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const nextStem = normalizeWordStem(nextWord);
  if (nextStem) {
    const candidates = [nextStem];
    if (nextStem.length > 3) {
      candidates.push(nextStem.slice(1));
    }

    const lowerCleaned = cleaned.toLowerCase();
    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      const idx = lowerCleaned.indexOf(candidate);
      if (idx > 0) {
        const before = cleaned.slice(0, idx).trim();
        const after = cleaned.slice(idx);
        const looksLikeNextEntry = /\/\[[^\]]+\]/.test(after) || /\b(n\.|v\.|vt\.|vi\.|adj\.|adv\.|pron\.|prep\.|conj\.)\b/i.test(after);
        if (containsChinese(before) && looksLikeNextEntry) {
          cleaned = before.replace(/[，,;；、\s]+$/, '');
          break;
        }
      }
    }
  }

  const genericMatch = cleaned.match(/^(.+?[\u4e00-\u9fa5）\)])\s+[A-Za-z][A-Za-z()\-\s.'/]*\/\[[^\]]+\].*$/);
  if (genericMatch) {
    cleaned = genericMatch[1].replace(/[，,;；、\s]+$/, '');
  }

  return cleaned;
}

function sanitizeWordEntries(words) {
  if (!Array.isArray(words)) return [];
  return words.map((item, index) => {
    if (!item || typeof item !== 'object') return item;
    const nextWord = words[index + 1] && words[index + 1].word ? words[index + 1].word : '';
    const fixedMeaning = sanitizeMergedMeaning(item.meaning, nextWord);
    if (fixedMeaning === item.meaning) {
      return item;
    }
    return {
      ...item,
      meaning: fixedMeaning
    };
  });
}

// 辅助函数
const generateWordsForBook = function (bookCategory, bookId, startIndex, count) {
  const allWordbooks = [...primaryWordbooks, ...juniorWordbooks, ...seniorWordbooks];
  const book = allWordbooks.find(b => b.id === bookId);
  if (!book) return [];
  
  let words = [];
  
  // 直接根据词书类型加载对应的JS文件，避免JSON加载的兼容性问题
    try {
      // 使用data目录下的JS文件而不是JSON文件，适配小程序环境
      // 注意：这些JS文件直接导出数组，而不是包含数组的对象
      
      // 清除require缓存，确保每次都加载最新的单词文件
      // 在Node.js环境中使用
      if (typeof require !== 'undefined' && require.cache) {
        // 清除所有可能的单词文件缓存
        const filesToClear = [
          './primary_real_words.js',
          './初中中考词汇.js',
          './ji_7th_grade_second.js',
          './ji_7th_grade_second_complete.js',
          './ji_7th_grade_words.js',
          './yi_lin_7th_grade_first.js',
          './yi_lin_7th_grade_second.js',
          './yi_lin_8th_grade_first.js',
          './yi_lin_8th_grade_second.js',
          './yi_lin_9th_grade_first.js',
          './yi_lin_9th_grade_second.js',
          './new_standard_7th_grade_second.js',
          './new_standard_7th_grade_second_complete.js',
          './new_standard_7th_grade_words.js',
          './ji_8th_grade_second.js',
          './ji_8th_grade_second_complete.js',
          './ji_8th_grade_first.js',
          './ji_8th_grade_first_complete.js',
          './new_standard_8th_grade_second.js',
          './new_standard_8th_grade_second_complete.js',
          './new_standard_8th_grade_words.js',
          './new_standard_8th_grade_words_complete.js',
          './ji_9th_grade_words.js',
          './new_standard_9th_grade_second.js',
          './new_standard_9th_grade_second_complete.js',
          './new_standard_9th_grade_words.js',
          './new_standard_9th_grade_first_complete.js',
          './junior_real_words.js',
          // 人教版初中重录版（v2）
          './ren_jiao_7th_grade_first_v2.js',
          './ren_jiao_7th_grade_second_v2.js',
          './ren_jiao_8th_grade_first_v2.js',
          './ren_jiao_8th_grade_second_v2.js',
          './ren_jiao_9th_grade_v2.js'
        ];
        
        filesToClear.forEach(filePath => {
          try {
            const resolvedPath = require.resolve(filePath);
            delete require.cache[resolvedPath];
          } catch (e) {
            // 文件不存在，忽略错误
          }
        });
      }
      
      // ===== 人教版初中重录版（v2）路由 =====
      if (bookId === 'junior_7th_ren_jiao_v2') {
        words = require('./ren_jiao_7th_grade_first_v2.js');
        console.log('成功加载人教版七年级上册 v2（重录版），数量：', words.length);
      } else if (bookId === 'junior_7th_ren_jiao_second_v2') {
        words = require('./ren_jiao_7th_grade_second_v2.js');
        console.log('成功加载人教版七年级下册 v2（重录版），数量：', words.length);
      } else if (bookId === 'junior_8th_ren_jiao_v2') {
        words = require('./ren_jiao_8th_grade_first_v2.js');
        console.log('成功加载人教版八年级上册 v2（重录版），数量：', words.length);
      } else if (bookId === 'junior_8th_ren_jiao_second_v2') {
        words = require('./ren_jiao_8th_grade_second_v2.js');
        console.log('成功加载人教版八年级下册 v2（重录版），数量：', words.length);
      } else if (bookId === 'junior_9th_ren_jiao_v2') {
        words = require('./ren_jiao_9th_grade_v2.js');
        console.log('成功加载人教版九年级全一册 v2（重录版），数量：', words.length);
      } else if (bookId.includes('primary')) {
        words = require('./primary_real_words.js');
      } else if (bookId.includes('junior')) {
        if (bookId.includes('exam')) {
          words = require('./初中中考词汇.js');
        } else if (bookId.includes('7th')) {
          if (bookId.includes('ren_jiao')) {
            if (bookId.includes('8th')) {
              // 人教版八年级上册
              words = require('./ren_jiao_8th_grade_first.js');
            } else if (bookId.includes('second')) {
              // 人教版七年级下册
              words = require('./ren_jiao_7th_grade_second.js');
            } else {
              // 人教版七年级上册
              words = require('./ren_jiao_7th_grade_first.js');
              console.log('成功加载人教版七年级上册单词列表，数量：', words.length);
            }
          } else if (bookId.includes('ji')) {
            if (bookId.includes('second')) {
              // 冀教版七年级下册 - 使用完整单词列表
              try {
                words = require('./ji_7th_grade_second_complete.js');
                console.log('成功加载完整的冀教版七年级下册单词列表，数量：', words.length);
              } catch (e) {
                console.error('加载完整单词列表失败，尝试加载备用文件:', e);
                words = require('./ji_7th_grade_second.js');
              }
            } else {
              words = require('./ji_7th_grade_words.js');
            }
          } else if (bookId.includes('yi_lin')) {
            if (bookId.includes('9th') && bookId.includes('second')) {
              // 译林牛津版九年级下册
              words = require('./yi_lin_9th_grade_second.js');
            } else if (bookId.includes('9th')) {
              // 译林牛津版九年级上册
              words = require('./yi_lin_9th_grade_first.js');
            } else if (bookId.includes('8th') && bookId.includes('second')) {
              // 译林牛津版八年级下册
              words = require('./yi_lin_8th_grade_second.js');
            } else if (bookId.includes('8th')) {
              // 译林牛津版八年级上册
              words = require('./yi_lin_8th_grade_first.js');
            } else if (bookId.includes('second')) {
              // 译林牛津版七年级下册
              words = require('./yi_lin_7th_grade_second.js');
            } else {
              // 译林牛津版七年级上册
              words = require('./yi_lin_7th_grade_first.js');
            }
          } else {
            if (bookId.includes('second')) {
              // 外研社七年级下册 - 使用完整单词列表
              try {
                words = require('./new_standard_7th_grade_second_complete.js');
                console.log('成功加载完整的外研社七年级下册单词列表，数量：', words.length);
              } catch (e) {
                console.error('加载完整单词列表失败，尝试加载备用文件:', e);
                words = require('./new_standard_7th_grade_second.js');
              }
            } else {
              // 外研社七年级上册
              words = require('./new_standard_7th_grade_words.js');
            }
          }
        } else if (bookId.includes('8th')) {
          if (bookId.includes('ren_jiao')) {
            if (bookId.includes('second')) {
              // 人教版八年级下册
              words = require('./ren_jiao_8th_grade_second.js');
              console.log('成功加载人教版八年级下册单词列表，数量：', words.length);
            } else {
              // 人教版八年级上册
              words = require('./ren_jiao_8th_grade_first.js');
              console.log('成功加载人教版八年级上册单词列表，数量：', words.length);
            }
          } else if (bookId.includes('ji')) {
            if (bookId.includes('second')) {
              // 冀教版八年级下册 - 使用完整单词列表
              try {
                words = require('./ji_8th_grade_second_complete.js');
                console.log('成功加载完整的冀教版八年级下册单词列表，数量：', words.length);
              } catch (e) {
                console.error('加载完整单词列表失败，尝试加载备用文件:', e);
                words = require('./ji_8th_grade_second.js');
              }
            } else {
              // 冀教版八年级上册 - 使用完整单词列表
              try {
                words = require('./ji_8th_grade_first_complete.js');
                console.log('成功加载完整的冀教版八年级上册单词列表，数量：', words.length);
              } catch (e) {
                console.error('加载完整单词列表失败，尝试加载备用文件:', e);
                words = require('./ji_8th_grade_first.js');
              }
            }
          } else if (bookId.includes('yi_lin')) {
            if (bookId.includes('second')) {
              words = require('./yi_lin_8th_grade_second.js');
            } else {
              words = require('./yi_lin_8th_grade_first.js');
            }
          } else if (bookId.includes('second')) {
            // 外研社八年级下册 - 使用完整单词列表
            try {
              words = require('./new_standard_8th_grade_second_complete.js');
              console.log('成功加载完整的外研社八年级下册单词列表，数量：', words.length);
            } catch (e) {
              console.error('加载完整单词列表失败，尝试加载备用文件:', e);
              words = require('./new_standard_8th_grade_second.js');
            }
          } else {
            // 外研社八年级上册 - 使用完整单词列表
            try {
              words = require('./new_standard_8th_grade_words_complete.js');
              console.log('成功加载完整的外研社八年级上册单词列表，数量：', words.length);
            } catch (e) {
              console.error('加载完整单词列表失败，尝试加载备用文件:', e);
              words = require('./new_standard_8th_grade_words.js');
            }
          }
        } else if (bookId.includes('9th')) {
          if (bookId.includes('ren_jiao')) {
            // 人教版九年级全一册
            words = require('./ren_jiao_9th_grade.js');
            console.log('成功加载人教版九年级全一册单词列表，数量：', words.length);
          } else if (bookId.includes('ji')) {
            // 冀教版九年级全一册 - 使用完整单词列表
            try {
              words = require('./ji_9th_grade_complete.js');
              console.log('成功加载完整的冀教版九年级全一册单词列表，数量：', words.length);
            } catch (e) {
              console.error('加载完整单词列表失败，尝试加载备用文件:', e);
              words = require('./ji_9th_grade_words.js');
            }
          } else if (bookId.includes('yi_lin')) {
            if (bookId.includes('second')) {
              words = require('./yi_lin_9th_grade_second.js');
            } else {
              words = require('./yi_lin_9th_grade_first.js');
            }
          } else if (bookId.includes('second')) {
            // 外研社九年级下册 - 使用完整单词列表
            try {
              words = require('./new_standard_9th_grade_second_complete.js');
              console.log('成功加载完整的外研社九年级下册单词列表，数量：', words.length);
            } catch (e) {
              console.error('加载完整单词列表失败，尝试加载备用文件:', e);
              words = require('./new_standard_9th_grade_second.js');
            }
          } else {
            // 外研社九年级上册 - 使用完整单词列表
            try {
              words = require('./new_standard_9th_grade_first_complete.js');
              console.log('成功加载完整的外研社九年级上册单词列表，数量：', words.length);
            } catch (e) {
              console.error('加载完整单词列表失败，尝试加载备用文件:', e);
              words = require('./new_standard_9th_grade_words.js');
            }
          }
        } else {
          words = require('./junior_real_words.js');
        }
      } else if (bookId.includes('senior') || bookId.includes('gaokao')) {
        if (bookId.includes('ren_jiao') && bookId.includes('book_3')) {
          // 人教版高中必修三
          words = require('./ren_jiao_senior_book_3.js');
          console.log('成功加载人教版高中必修三单词，数量：', words.length);
        } else if (bookId.includes('ren_jiao') && bookId.includes('book_2')) {
          // 人教版高中必修二
          words = require('./ren_jiao_senior_book_2.js');
          console.log('成功加载人教版高中必修二单词，数量：', words.length);
        } else if (bookId.includes('ren_jiao') && bookId.includes('book_1')) {
          // 人教版高中必修一
          words = require('./ren_jiao_senior_book_1.js');
          console.log('成功加载人教版高中必修一单词，数量：', words.length);
        } else if (bookId.includes('new_curriculum')) {
          // 【云端迁移】优先从本地缓存读取云端词书数据
          const cloudWords = cloudWordbookLoader.getWordsSync('new_curriculum_senior');
          if (cloudWords && cloudWords.length > 0) {
            words = cloudWords;
            console.log('成功从云端缓存加载新课标高中英语词汇，数量：', words.length);
          } else {
            // 缓存未命中，使用词书定义中的默认单词
            console.log('新课标高中英语词汇云端缓存未命中，使用词书默认单词，数量：', book.words ? book.words.length : 0);
            words = book.words || [];
          }
        } else if (bookId.includes('gaokao')) {
          // 【云端迁移】优先从本地缓存读取云端词书数据
          const cloudWords = cloudWordbookLoader.getWordsSync('gaokao_reading_words');
          if (cloudWords && cloudWords.length > 0) {
            words = cloudWords;
            console.log('成功从云端缓存加载高考英语阅读高频词汇，数量：', words.length);
          } else {
            // 缓存未命中，使用词书定义中的默认单词
            console.log('高考英语阅读高频词汇云端缓存未命中，使用词书默认单词，数量：', book.words ? book.words.length : 0);
            words = book.words || [];
          }
        } else if (
          bookId === 'senior_exam_syllabus' ||
          bookId === 'senior_exam_syllabus_level_0' ||
          bookId === 'senior_exam_syllabus_level_1' ||
          bookId === 'senior_exam_syllabus_level_2'
        ) {
          const cloudWords = cloudWordbookLoader.getWordsSync(bookId);
          if (cloudWords && cloudWords.length > 0) {
            words = cloudWords;
            console.log('成功从云端缓存加载高中考纲词书，数量：', words.length);
          } else {
            console.log('高中考纲词书云端缓存未命中，使用词书默认单词，数量：', book.words ? book.words.length : 0);
            words = book.words || [];
          }
        } else if (bookId === 'senior_textbook_real') {
          // 【云端迁移】优先从本地缓存读取云端词书数据
          const cloudWords = cloudWordbookLoader.getWordsSync('senior_textbook_real');
          if (cloudWords && cloudWords.length > 0) {
            words = cloudWords;
            console.log('成功从云端缓存加载高中统编版英语词书，数量：', words.length);
          } else {
            // 缓存未命中，使用词书默认单词
            console.log('高中统编版云端缓存未命中，使用词书默认单词，数量：', book.words ? book.words.length : 0);
            words = book.words || [];
          }
        } else {
          words = book.words || [];
        }
      }
      words = sanitizeWordEntries(words);
      console.log(`成功加载${bookId}的JS文件，单词数量：${words.length}`);
    } catch (error) {
      console.error('加载教材单词数据失败:', error);
      console.error('错误详情:', error.stack);
      
      // 如果JS文件加载失败，使用词书中的默认单词作为备选
      console.log('使用词书默认单词，数量：', book.words ? book.words.length : 0);
      words = book.words || [];
    }
  
  const result = words.slice(startIndex, startIndex + count);
  result._totalCount = words.length;
  
  // 特殊处理高考英语阅读高频词汇
  if (bookId.includes('gaokao')) {
    // 强制设置单词数量为687
    result._totalCount = 687;
    console.log('高考英语阅读高频词汇总单词数设置为：', result._totalCount);
  }
  
  // 特殊处理译林牛津版七年级上册词书，确保加载所有单词
  if (bookId === 'junior_7th_yi_lin') {
    // 强制设置单词数量为476，确保学习页面加载所有单词
    result._totalCount = 476;
    console.log('译林牛津版七年级上册总单词数设置为：', result._totalCount);
  }
  
  // 特殊处理人教版七年级上册词书（新旧两版），确保加载所有单词
  if (bookId === 'junior_7th_ren_jiao') {
    // 强制设置单词数量为419，确保学习页面加载所有单词
    result._totalCount = 419;
    console.log('人教版七年级上册总单词数设置为：', result._totalCount);
  }
  if (bookId === 'junior_7th_ren_jiao_v2') {
    result._totalCount = words.length;
    console.log('人教版七年级上册 v2（重录版）总单词数设置为：', result._totalCount);
  }
  
  return result;
};

const getBookById = function (bookId) {
  const allWordbooks = [...primaryWordbooks, ...juniorWordbooks, ...seniorWordbooks];
  return allWordbooks.find(b => b.id === bookId) || null;
};

const getBooksByCategory = function (category) {
  switch (category) {
    case 'primary':
      return primaryWordbooks;
    case 'junior':
      return juniorWordbooks;
    case 'senior':
      return seniorWordbooks;
    default:
      return [];
  }
};

// 导出数据和辅助函数
module.exports = {
  primary: primaryWordbooks,
  junior: juniorWordbooks,
  senior: seniorWordbooks,
  generateWordsForBook,
  getBookById,
  getBooksByCategory
};
