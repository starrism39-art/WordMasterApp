const primaryRealWords = [
  {
    "word": "hello",
    "phonetic": "/həˈləʊ/",
    "meaning": "你好"
  },
  {
    "word": "world",
    "phonetic": "/wɜːld/",
    "meaning": "世界"
  },
  {
    "word": "good",
    "phonetic": "/ɡʊd/",
    "meaning": "好的"
  },
  {
    "word": "morning",
    "phonetic": "/ˈmɔːnɪŋ/",
    "meaning": "早晨"
  },
  {
    "word": "afternoon",
    "phonetic": "/ˌɑːftəˈnuːn/",
    "meaning": "下午"
  },
  {
    "word": "night",
    "phonetic": "/naɪt/",
    "meaning": "夜晚"
  },
  {
    "word": "name",
    "phonetic": "/neɪm/",
    "meaning": "名字"
  },
  {
    "word": "my",
    "phonetic": "/maɪ/",
    "meaning": "我的"
  },
  {
    "word": "your",
    "phonetic": "/jɔː(r)/",
    "meaning": "你的"
  },
  {
    "word": "I",
    "phonetic": "/aɪ/",
    "meaning": "我"
  },
  {
    "word": "you",
    "phonetic": "/juː/",
    "meaning": "你"
  },
  {
    "word": "he",
    "phonetic": "/hiː/",
    "meaning": "他"
  },
  {
    "word": "she",
    "phonetic": "/ʃiː/",
    "meaning": "她"
  },
  {
    "word": "it",
    "phonetic": "/ɪt/",
    "meaning": "它"
  },
  {
    "word": "we",
    "phonetic": "/wiː/",
    "meaning": "我们"
  },
  {
    "word": "they",
    "phonetic": "/ðeɪ/",
    "meaning": "他们"
  },
  {
    "word": "and",
    "phonetic": "/ænd/",
    "meaning": "和"
  },
  {
    "word": "is",
    "phonetic": "/ɪz/",
    "meaning": "是"
  },
  {
    "word": "are",
    "phonetic": "/ɑː(r)/",
    "meaning": "是"
  },
  {
    "word": "am",
    "phonetic": "/æm/",
    "meaning": "是"
  },
  {
    "word": "not",
    "phonetic": "/nɒt/",
    "meaning": "不"
  },
  {
    "word": "yes",
    "phonetic": "/jes/",
    "meaning": "是"
  },
  {
    "word": "no",
    "phonetic": "/nəʊ/",
    "meaning": "不"
  },
  {
    "word": "in",
    "phonetic": "/ɪn/",
    "meaning": "在...里"
  },
  {
    "word": "on",
    "phonetic": "/ɒn/",
    "meaning": "在...上"
  },
  {
    "word": "at",
    "phonetic": "/æt/",
    "meaning": "在"
  },
  {
    "word": "to",
    "phonetic": "/tuː/",
    "meaning": "到"
  },
  {
    "word": "for",
    "phonetic": "/fɔː(r)/",
    "meaning": "为了"
  },
  {
    "word": "of",
    "phonetic": "/ɒv/",
    "meaning": "的"
  },
  {
    "word": "with",
    "phonetic": "/wɪð/",
    "meaning": "和"
  },
  {
    "word": "a",
    "phonetic": "/ə/",
    "meaning": "一"
  },
  {
    "word": "an",
    "phonetic": "/æn/",
    "meaning": "一"
  },
  {
    "word": "the",
    "phonetic": "/ðə/",
    "meaning": "这"
  },
  {
    "word": "this",
    "phonetic": "/ðɪs/",
    "meaning": "这个"
  },
  {
    "word": "that",
    "phonetic": "/ðæt/",
    "meaning": "那个"
  },
  {
    "word": "what",
    "phonetic": "/wɒt/",
    "meaning": "什么"
  },
  {
    "word": "where",
    "phonetic": "/weə(r)/",
    "meaning": "哪里"
  },
  {
    "word": "when",
    "phonetic": "/wen/",
    "meaning": "何时"
  },
  {
    "word": "how",
    "phonetic": "/haʊ/",
    "meaning": "如何"
  },
  {
    "word": "who",
    "phonetic": "/huː/",
    "meaning": "谁"
  },
  {
    "word": "book",
    "phonetic": "/bʊk/",
    "meaning": "书"
  },
  {
    "word": "pen",
    "phonetic": "/pen/",
    "meaning": "钢笔"
  },
  {
    "word": "pencil",
    "phonetic": "/ˈpensl/",
    "meaning": "铅笔"
  },
  {
    "word": "ruler",
    "phonetic": "/ˈruːlə(r)/",
    "meaning": "尺子"
  },
  {
    "word": "bag",
    "phonetic": "/bæɡ/",
    "meaning": "书包"
  },
  {
    "word": "desk",
    "phonetic": "/desk/",
    "meaning": "桌子"
  },
  {
    "word": "chair",
    "phonetic": "/tʃeə(r)/",
    "meaning": "椅子"
  },
  {
    "word": "school",
    "phonetic": "/skuːl/",
    "meaning": "学校"
  },
  {
    "word": "teacher",
    "phonetic": "/ˈtiːtʃə(r)/",
    "meaning": "老师"
  },
  {
    "word": "student",
    "phonetic": "/ˈstjuːdənt/",
    "meaning": "学生"
  },
  {
    "word": "friend",
    "phonetic": "/frend/",
    "meaning": "朋友"
  },
  {
    "word": "family",
    "phonetic": "/ˈfæməli/",
    "meaning": "家庭"
  },
  {
    "word": "father",
    "phonetic": "/ˈfɑːðə(r)/",
    "meaning": "父亲"
  },
  {
    "word": "mother",
    "phonetic": "/ˈmʌðə(r)/",
    "meaning": "母亲"
  },
  {
    "word": "brother",
    "phonetic": "/ˈbrʌðə(r)/",
    "meaning": "兄弟"
  },
  {
    "word": "sister",
    "phonetic": "/ˈsɪstə(r)/",
    "meaning": "姐妹"
  },
  {
    "word": "cat",
    "phonetic": "/kæt/",
    "meaning": "猫"
  },
  {
    "word": "dog",
    "phonetic": "/dɒɡ/",
    "meaning": "狗"
  },
  {
    "word": "bird",
    "phonetic": "/bɜːd/",
    "meaning": "鸟"
  },
  {
    "word": "fish",
    "phonetic": "/fɪʃ/",
    "meaning": "鱼"
  },
  {
    "word": "apple",
    "phonetic": "/ˈæpl/",
    "meaning": "苹果"
  },
  {
    "word": "banana",
    "phonetic": "/bəˈnɑːnə/",
    "meaning": "香蕉"
  },
  {
    "word": "orange",
    "phonetic": "/ˈɒrɪndʒ/",
    "meaning": "橙子"
  },
  {
    "word": "water",
    "phonetic": "/ˈwɔːtə(r)/",
    "meaning": "水"
  },
  {
    "word": "milk",
    "phonetic": "/mɪlk/",
    "meaning": "牛奶"
  },
  {
    "word": "food",
    "phonetic": "/fuːd/",
    "meaning": "食物"
  },
  {
    "word": "rice",
    "phonetic": "/raɪs/",
    "meaning": "米饭"
  },
  {
    "word": "bread",
    "phonetic": "/bred/",
    "meaning": "面包"
  },
  {
    "word": "one",
    "phonetic": "/wʌn/",
    "meaning": "一"
  },
  {
    "word": "two",
    "phonetic": "/tuː/",
    "meaning": "二"
  },
  {
    "word": "three",
    "phonetic": "/θriː/",
    "meaning": "三"
  },
  {
    "word": "four",
    "phonetic": "/fɔː(r)/",
    "meaning": "四"
  },
  {
    "word": "five",
    "phonetic": "/faɪv/",
    "meaning": "五"
  },
  {
    "word": "six",
    "phonetic": "/sɪks/",
    "meaning": "六"
  },
  {
    "word": "seven",
    "phonetic": "/ˈsevn/",
    "meaning": "七"
  },
  {
    "word": "eight",
    "phonetic": "/eɪt/",
    "meaning": "八"
  },
  {
    "word": "nine",
    "phonetic": "/naɪn/",
    "meaning": "九"
  },
  {
    "word": "ten",
    "phonetic": "/ten/",
    "meaning": "十"
  },
  {
    "word": "red",
    "phonetic": "/red/",
    "meaning": "红色"
  },
  {
    "word": "blue",
    "phonetic": "/bluː/",
    "meaning": "蓝色"
  },
  {
    "word": "green",
    "phonetic": "/ɡriːn/",
    "meaning": "绿色"
  },
  {
    "word": "yellow",
    "phonetic": "/ˈjeləʊ/",
    "meaning": "黄色"
  },
  {
    "word": "big",
    "phonetic": "/bɪɡ/",
    "meaning": "大的"
  },
  {
    "word": "small",
    "phonetic": "/smɔːl/",
    "meaning": "小的"
  },
  {
    "word": "tall",
    "phonetic": "/tɔːl/",
    "meaning": "高的"
  },
  {
    "word": "short",
    "phonetic": "/ʃɔːt/",
    "meaning": "短的"
  },
  {
    "word": "long",
    "phonetic": "/lɒŋ/",
    "meaning": "长的"
  },
  {
    "word": "happy",
    "phonetic": "/ˈhæpi/",
    "meaning": "快乐的"
  },
  {
    "word": "sad",
    "phonetic": "/sæd/",
    "meaning": "悲伤的"
  },
  {
    "word": "hot",
    "phonetic": "/hɒt/",
    "meaning": "热的"
  },
  {
    "word": "cold",
    "phonetic": "/kəʊld/",
    "meaning": "冷的"
  },
  {
    "word": "new",
    "phonetic": "/njuː/",
    "meaning": "新的"
  },
  {
    "word": "old",
    "phonetic": "/əʊld/",
    "meaning": "旧的"
  },
  {
    "word": "go",
    "phonetic": "/ɡəʊ/",
    "meaning": "去"
  },
  {
    "word": "come",
    "phonetic": "/kʌm/",
    "meaning": "来"
  },
  {
    "word": "see",
    "phonetic": "/siː/",
    "meaning": "看见"
  },
  {
    "word": "look",
    "phonetic": "/lʊk/",
    "meaning": "看"
  },
  {
    "word": "read",
    "phonetic": "/riːd/",
    "meaning": "读"
  },
  {
    "word": "write",
    "phonetic": "/raɪt/",
    "meaning": "写"
  },
  {
    "word": "listen",
    "phonetic": "/ˈlɪsn/",
    "meaning": "听"
  },
  {
    "word": "speak",
    "phonetic": "/spiːk/",
    "meaning": "说"
  },
  {
    "word": "play",
    "phonetic": "/pleɪ/",
    "meaning": "玩"
  },
  {
    "word": "like",
    "phonetic": "/laɪk/",
    "meaning": "喜欢"
  },
  {
    "word": "love",
    "phonetic": "/lʌv/",
    "meaning": "爱"
  },
  {
    "word": "thank",
    "phonetic": "/θæŋk/",
    "meaning": "谢谢"
  },
  {
    "word": "please",
    "phonetic": "/pliːz/",
    "meaning": "请"
  },
  {
    "word": "sorry",
    "phonetic": "/ˈsɒri/",
    "meaning": "对不起"
  },
  {
    "word": "time",
    "phonetic": "/taɪm/",
    "meaning": "时间"
  },
  {
    "word": "day",
    "phonetic": "/deɪ/",
    "meaning": "天"
  },
  {
    "word": "week",
    "phonetic": "/wiːk/",
    "meaning": "周"
  },
  {
    "word": "month",
    "phonetic": "/mʌnθ/",
    "meaning": "月"
  },
  {
    "word": "year",
    "phonetic": "/jɪə(r)/",
    "meaning": "年"
  },
  {
    "word": "today",
    "phonetic": "/təˈdeɪ/",
    "meaning": "今天"
  },
  {
    "word": "tomorrow",
    "phonetic": "/təˈmɒrəʊ/",
    "meaning": "明天"
  },
  {
    "word": "yesterday",
    "phonetic": "/ˈjestədeɪ/",
    "meaning": "昨天"
  },
  {
    "word": "monday",
    "phonetic": "/ˈmʌndeɪ/",
    "meaning": "星期一"
  },
  {
    "word": "tuesday",
    "phonetic": "/ˈtjuːzdeɪ/",
    "meaning": "星期二"
  },
  {
    "word": "wednesday",
    "phonetic": "/ˈwenzdeɪ/",
    "meaning": "星期三"
  },
  {
    "word": "thursday",
    "phonetic": "/ˈθɜːzdeɪ/",
    "meaning": "星期四"
  },
  {
    "word": "friday",
    "phonetic": "/ˈfraɪdeɪ/",
    "meaning": "星期五"
  },
  {
    "word": "saturday",
    "phonetic": "/ˈsætədeɪ/",
    "meaning": "星期六"
  },
  {
    "word": "sunday",
    "phonetic": "/ˈsʌndeɪ/",
    "meaning": "星期日"
  },
  {
    "word": "january",
    "phonetic": "/ˈdʒænjuəri/",
    "meaning": "一月"
  },
  {
    "word": "february",
    "phonetic": "/ˈfebruəri/",
    "meaning": "二月"
  },
  {
    "word": "march",
    "phonetic": "/mɑːtʃ/",
    "meaning": "三月"
  },
  {
    "word": "april",
    "phonetic": "/ˈeɪprəl/",
    "meaning": "四月"
  },
  {
    "word": "may",
    "phonetic": "/meɪ/",
    "meaning": "五月"
  },
  {
    "word": "june",
    "phonetic": "/dʒuːn/",
    "meaning": "六月"
  },
  {
    "word": "july",
    "phonetic": "/dʒuˈlaɪ/",
    "meaning": "七月"
  },
  {
    "word": "august",
    "phonetic": "/ˈɔːɡəst/",
    "meaning": "八月"
  },
  {
    "word": "september",
    "phonetic": "/sepˈtembə(r)/",
    "meaning": "九月"
  },
  {
    "word": "october",
    "phonetic": "/ɒkˈtəʊbə(r)/",
    "meaning": "十月"
  },
  {
    "word": "november",
    "phonetic": "/nəʊˈvembə(r)/",
    "meaning": "十一月"
  },
  {
    "word": "december",
    "phonetic": "/dɪˈsembə(r)/",
    "meaning": "十二月"
  },
  {
    "word": "birthday",
    "phonetic": "/ˈbɜːθdeɪ/",
    "meaning": "生日"
  },
  {
    "word": "party",
    "phonetic": "/ˈpɑːti/",
    "meaning": "派对"
  },
  {
    "word": "gift",
    "phonetic": "/ɡɪft/",
    "meaning": "礼物"
  },
  {
    "word": "game",
    "phonetic": "/ɡeɪm/",
    "meaning": "游戏"
  },
  {
    "word": "song",
    "phonetic": "/sɒŋ/",
    "meaning": "歌曲"
  },
  {
    "word": "dance",
    "phonetic": "/dɑːns/",
    "meaning": "跳舞"
  },
  {
    "word": "music",
    "phonetic": "/ˈmjuːzɪk/",
    "meaning": "音乐"
  },
  {
    "word": "art",
    "phonetic": "/ɑːt/",
    "meaning": "艺术"
  },
  {
    "word": "math",
    "phonetic": "/mæθ/",
    "meaning": "数学"
  },
  {
    "word": "english",
    "phonetic": "/ˈɪŋɡlɪʃ/",
    "meaning": "英语"
  },
  {
    "word": "chinese",
    "phonetic": "/ˌtʃaɪˈniːz/",
    "meaning": "语文"
  },
  {
    "word": "science",
    "phonetic": "/ˈsaɪəns/",
    "meaning": "科学"
  },
  {
    "word": "history",
    "phonetic": "/ˈhɪstri/",
    "meaning": "历史"
  },
  {
    "word": "geography",
    "phonetic": "/dʒiˈɒɡrəfi/",
    "meaning": "地理"
  },
  {
    "word": "PE",
    "phonetic": "/ˌpiː ˈiː/",
    "meaning": "体育"
  },
  {
    "word": "computer",
    "phonetic": "/kəmˈpjuːtə(r)/",
    "meaning": "电脑"
  },
  {
    "word": "phone",
    "phonetic": "/fəʊn/",
    "meaning": "电话"
  },
  {
    "word": "TV",
    "phonetic": "/ˌtiː ˈviː/",
    "meaning": "电视"
  },
  {
    "word": "radio",
    "phonetic": "/ˈreɪdiəʊ/",
    "meaning": "收音机"
  },
  {
    "word": "clock",
    "phonetic": "/klɒk/",
    "meaning": "时钟"
  },
  {
    "word": "watch",
    "phonetic": "/wɒtʃ/",
    "meaning": "手表"
  },
  {
    "word": "map",
    "phonetic": "/mæp/",
    "meaning": "地图"
  },
  {
    "word": "picture",
    "phonetic": "/ˈpɪktʃə(r)/",
    "meaning": "图片"
  },
  {
    "word": "photo",
    "phonetic": "/ˈfəʊtəʊ/",
    "meaning": "照片"
  },
  {
    "word": "story",
    "phonetic": "/ˈstɔːri/",
    "meaning": "故事"
  },
  {
    "word": "drawing",
    "phonetic": "/ˈdrɔːɪŋ/",
    "meaning": "图画"
  },
  {
    "word": "colour",
    "phonetic": "/ˈkʌlə(r)/",
    "meaning": "颜色"
  },
  {
    "word": "black",
    "phonetic": "/blæk/",
    "meaning": "黑色"
  },
  {
    "word": "white",
    "phonetic": "/waɪt/",
    "meaning": "白色"
  },
  {
    "word": "brown",
    "phonetic": "/braʊn/",
    "meaning": "棕色"
  },
  {
    "word": "purple",
    "phonetic": "/ˈpɜːpl/",
    "meaning": "紫色"
  },
  {
    "word": "pink",
    "phonetic": "/pɪŋk/",
    "meaning": "粉色"
  },
  {
    "word": "gray",
    "phonetic": "/ɡreɪ/",
    "meaning": "灰色"
  },
  {
    "word": "face",
    "phonetic": "/feɪs/",
    "meaning": "脸"
  },
  {
    "word": "eye",
    "phonetic": "/aɪ/",
    "meaning": "眼睛"
  },
  {
    "word": "nose",
    "phonetic": "/nəʊz/",
    "meaning": "鼻子"
  },
  {
    "word": "mouth",
    "phonetic": "/maʊθ/",
    "meaning": "嘴巴"
  },
  {
    "word": "ear",
    "phonetic": "/ɪə(r)/",
    "meaning": "耳朵"
  },
  {
    "word": "head",
    "phonetic": "/hed/",
    "meaning": "头"
  },
  {
    "word": "hand",
    "phonetic": "/hænd/",
    "meaning": "手"
  },
  {
    "word": "foot",
    "phonetic": "/fʊt/",
    "meaning": "脚"
  },
  {
    "word": "arm",
    "phonetic": "/ɑːm/",
    "meaning": "手臂"
  },
  {
    "word": "leg",
    "phonetic": "/leɡ/",
    "meaning": "腿"
  },
  {
    "word": "body",
    "phonetic": "/ˈbɒdi/",
    "meaning": "身体"
  },
  {
    "word": "hair",
    "phonetic": "/heə(r)/",
    "meaning": "头发"
  },
  {
    "word": "boy",
    "phonetic": "/boy/",
    "meaning": "男孩"
  },
  {
    "word": "girl",
    "phonetic": "/girl/",
    "meaning": "女孩"
  },
  {
    "word": "man",
    "phonetic": "/man/",
    "meaning": "男人"
  },
  {
    "word": "woman",
    "phonetic": "/woman/",
    "meaning": "女人"
  },
  {
    "word": "child",
    "phonetic": "/child/",
    "meaning": "孩子"
  },
  {
    "word": "people",
    "phonetic": "/people/",
    "meaning": "人们"
  },
  {
    "word": "doctor",
    "phonetic": "/doctor/",
    "meaning": "医生"
  },
  {
    "word": "nurse",
    "phonetic": "/nurse/",
    "meaning": "护士"
  },
  {
    "word": "teacher",
    "phonetic": "/teacher/",
    "meaning": "老师"
  },
  {
    "word": "student",
    "phonetic": "/student/",
    "meaning": "学生"
  },
  {
    "word": "driver",
    "phonetic": "/driver/",
    "meaning": "司机"
  },
  {
    "word": "farmer",
    "phonetic": "/farmer/",
    "meaning": "农民"
  },
  {
    "word": "worker",
    "phonetic": "/worker/",
    "meaning": "工人"
  },
  {
    "word": "cook",
    "phonetic": "/cook/",
    "meaning": "厨师"
  },
  {
    "word": "police",
    "phonetic": "/police/",
    "meaning": "警察"
  },
  {
    "word": "fireman",
    "phonetic": "/fireman/",
    "meaning": "消防员"
  },
  {
    "word": "postman",
    "phonetic": "/postman/",
    "meaning": "邮递员"
  },
  {
    "word": "shop",
    "phonetic": "/shop/",
    "meaning": "商店"
  },
  {
    "word": "store",
    "phonetic": "/store/",
    "meaning": "商店"
  },
  {
    "word": "market",
    "phonetic": "/market/",
    "meaning": "市场"
  },
  {
    "word": "school",
    "phonetic": "/school/",
    "meaning": "学校"
  },
  {
    "word": "hospital",
    "phonetic": "/hospital/",
    "meaning": "医院"
  },
  {
    "word": "park",
    "phonetic": "/park/",
    "meaning": "公园"
  },
  {
    "word": "zoo",
    "phonetic": "/zoo/",
    "meaning": "动物园"
  },
  {
    "word": "cinema",
    "phonetic": "/cinema/",
    "meaning": "电影院"
  },
  {
    "word": "library",
    "phonetic": "/library/",
    "meaning": "图书馆"
  },
  {
    "word": "museum",
    "phonetic": "/museum/",
    "meaning": "博物馆"
  },
  {
    "word": "restaurant",
    "phonetic": "/restaurant/",
    "meaning": "餐馆"
  },
  {
    "word": "home",
    "phonetic": "/home/",
    "meaning": "家"
  },
  {
    "word": "house",
    "phonetic": "/house/",
    "meaning": "房子"
  },
  {
    "word": "room",
    "phonetic": "/room/",
    "meaning": "房间"
  },
  {
    "word": "bedroom",
    "phonetic": "/bedroom/",
    "meaning": "卧室"
  },
  {
    "word": "livingroom",
    "phonetic": "/livingroom/",
    "meaning": "客厅"
  },
  {
    "word": "kitchen",
    "phonetic": "/kitchen/",
    "meaning": "厨房"
  },
  {
    "word": "bathroom",
    "phonetic": "/bathroom/",
    "meaning": "浴室"
  },
  {
    "word": "bed",
    "phonetic": "/bed/",
    "meaning": "床"
  },
  {
    "word": "sofa",
    "phonetic": "/sofa/",
    "meaning": "沙发"
  },
  {
    "word": "table",
    "phonetic": "/table/",
    "meaning": "桌子"
  },
  {
    "word": "chair",
    "phonetic": "/chair/",
    "meaning": "椅子"
  },
  {
    "word": "window",
    "phonetic": "/window/",
    "meaning": "窗户"
  },
  {
    "word": "door",
    "phonetic": "/door/",
    "meaning": "门"
  },
  {
    "word": "wall",
    "phonetic": "/wall/",
    "meaning": "墙"
  },
  {
    "word": "floor",
    "phonetic": "/floor/",
    "meaning": "地板"
  },
  {
    "word": "ceiling",
    "phonetic": "/ceiling/",
    "meaning": "天花板"
  },
  {
    "word": "light",
    "phonetic": "/light/",
    "meaning": "灯"
  },
  {
    "word": "fan",
    "phonetic": "/fan/",
    "meaning": "风扇"
  },
  {
    "word": "air",
    "phonetic": "/air/",
    "meaning": "空气"
  },
  {
    "word": "water",
    "phonetic": "/water/",
    "meaning": "水"
  },
  {
    "word": "fire",
    "phonetic": "/fire/",
    "meaning": "火"
  },
  {
    "word": "earth",
    "phonetic": "/earth/",
    "meaning": "地球"
  },
  {
    "word": "sun",
    "phonetic": "/sun/",
    "meaning": "太阳"
  },
  {
    "word": "moon",
    "phonetic": "/moon/",
    "meaning": "月亮"
  },
  {
    "word": "star",
    "phonetic": "/star/",
    "meaning": "星星"
  },
  {
    "word": "sky",
    "phonetic": "/sky/",
    "meaning": "天空"
  },
  {
    "word": "cloud",
    "phonetic": "/cloud/",
    "meaning": "云"
  },
  {
    "word": "rain",
    "phonetic": "/rain/",
    "meaning": "雨"
  },
  {
    "word": "snow",
    "phonetic": "/snow/",
    "meaning": "雪"
  },
  {
    "word": "wind",
    "phonetic": "/wind/",
    "meaning": "风"
  },
  {
    "word": "weather",
    "phonetic": "/weather/",
    "meaning": "天气"
  },
  {
    "word": "season",
    "phonetic": "/season/",
    "meaning": "季节"
  },
  {
    "word": "spring",
    "phonetic": "/spring/",
    "meaning": "春天"
  },
  {
    "word": "summer",
    "phonetic": "/summer/",
    "meaning": "夏天"
  },
  {
    "word": "autumn",
    "phonetic": "/autumn/",
    "meaning": "秋天"
  },
  {
    "word": "winter",
    "phonetic": "/winter/",
    "meaning": "冬天"
  },
  {
    "word": "flower",
    "phonetic": "/flower/",
    "meaning": "花"
  },
  {
    "word": "tree",
    "phonetic": "/tree/",
    "meaning": "树"
  },
  {
    "word": "leaf",
    "phonetic": "/leaf/",
    "meaning": "叶子"
  },
  {
    "word": "grass",
    "phonetic": "/grass/",
    "meaning": "草"
  },
  {
    "word": "fruit",
    "phonetic": "/fruit/",
    "meaning": "水果"
  },
  {
    "word": "vegetable",
    "phonetic": "/vegetable/",
    "meaning": "蔬菜"
  },
  {
    "word": "meat",
    "phonetic": "/meat/",
    "meaning": "肉"
  },
  {
    "word": "fish",
    "phonetic": "/fish/",
    "meaning": "鱼"
  },
  {
    "word": "egg",
    "phonetic": "/egg/",
    "meaning": "鸡蛋"
  },
  {
    "word": "milk",
    "phonetic": "/milk/",
    "meaning": "牛奶"
  },
  {
    "word": "juice",
    "phonetic": "/juice/",
    "meaning": "果汁"
  },
  {
    "word": "tea",
    "phonetic": "/tea/",
    "meaning": "茶"
  },
  {
    "word": "coffee",
    "phonetic": "/coffee/",
    "meaning": "咖啡"
  },
  {
    "word": "cake",
    "phonetic": "/cake/",
    "meaning": "蛋糕"
  },
  {
    "word": "candy",
    "phonetic": "/candy/",
    "meaning": "糖果"
  },
  {
    "word": "chocolate",
    "phonetic": "/chocolate/",
    "meaning": "巧克力"
  },
  {
    "word": "ice",
    "phonetic": "/ice/",
    "meaning": "冰"
  },
  {
    "word": "cream",
    "phonetic": "/cream/",
    "meaning": "奶油"
  },
  {
    "word": "clothes",
    "phonetic": "/clothes/",
    "meaning": "衣服"
  },
  {
    "word": "shirt",
    "phonetic": "/shirt/",
    "meaning": "衬衫"
  },
  {
    "word": "skirt",
    "phonetic": "/skirt/",
    "meaning": "裙子"
  },
  {
    "word": "dress",
    "phonetic": "/dress/",
    "meaning": "连衣裙"
  },
  {
    "word": "pants",
    "phonetic": "/pants/",
    "meaning": "裤子"
  },
  {
    "word": "shorts",
    "phonetic": "/shorts/",
    "meaning": "短裤"
  },
  {
    "word": "socks",
    "phonetic": "/socks/",
    "meaning": "袜子"
  },
  {
    "word": "shoes",
    "phonetic": "/shoes/",
    "meaning": "鞋子"
  },
  {
    "word": "hat",
    "phonetic": "/hat/",
    "meaning": "帽子"
  },
  {
    "word": "cap",
    "phonetic": "/cap/",
    "meaning": "帽子"
  },
  {
    "word": "coat",
    "phonetic": "/coat/",
    "meaning": "外套"
  },
  {
    "word": "jacket",
    "phonetic": "/jacket/",
    "meaning": "夹克"
  },
  {
    "word": "sweater",
    "phonetic": "/sweater/",
    "meaning": "毛衣"
  },
  {
    "word": "scarf",
    "phonetic": "/scarf/",
    "meaning": "围巾"
  },
  {
    "word": "glove",
    "phonetic": "/glove/",
    "meaning": "手套"
  },
  {
    "word": "umbrella",
    "phonetic": "/umbrella/",
    "meaning": "雨伞"
  },
  {
    "word": "bag",
    "phonetic": "/bag/",
    "meaning": "包"
  },
  {
    "word": "backpack",
    "phonetic": "/backpack/",
    "meaning": "背包"
  },
  {
    "word": "purse",
    "phonetic": "/purse/",
    "meaning": "钱包"
  },
  {
    "word": "wallet",
    "phonetic": "/wallet/",
    "meaning": "钱包"
  },
  {
    "word": "key",
    "phonetic": "/key/",
    "meaning": "钥匙"
  },
  {
    "word": "money",
    "phonetic": "/money/",
    "meaning": "钱"
  },
  {
    "word": "card",
    "phonetic": "/card/",
    "meaning": "卡片"
  },
  {
    "word": "ticket",
    "phonetic": "/ticket/",
    "meaning": "票"
  },
  {
    "word": "book",
    "phonetic": "/book/",
    "meaning": "书"
  },
  {
    "word": "pen",
    "phonetic": "/pen/",
    "meaning": "钢笔"
  },
  {
    "word": "pencil",
    "phonetic": "/pencil/",
    "meaning": "铅笔"
  },
  {
    "word": "paper",
    "phonetic": "/paper/",
    "meaning": "纸"
  },
  {
    "word": "notebook",
    "phonetic": "/notebook/",
    "meaning": "笔记本"
  },
  {
    "word": "eraser",
    "phonetic": "/eraser/",
    "meaning": "橡皮擦"
  },
  {
    "word": "ruler",
    "phonetic": "/ruler/",
    "meaning": "尺子"
  },
  {
    "word": "pencilbox",
    "phonetic": "/pencilbox/",
    "meaning": "铅笔盒"
  },
  {
    "word": "schoolbag",
    "phonetic": "/schoolbag/",
    "meaning": "书包"
  },
  {
    "word": "desk",
    "phonetic": "/desk/",
    "meaning": "课桌"
  },
  {
    "word": "chair",
    "phonetic": "/chair/",
    "meaning": "椅子"
  },
  {
    "word": "board",
    "phonetic": "/board/",
    "meaning": "黑板"
  },
  {
    "word": "classroom",
    "phonetic": "/classroom/",
    "meaning": "教室"
  },
  {
    "word": "teacher",
    "phonetic": "/teacher/",
    "meaning": "老师"
  },
  {
    "word": "student",
    "phonetic": "/student/",
    "meaning": "学生"
  },
  {
    "word": "class",
    "phonetic": "/class/",
    "meaning": "班级"
  },
  {
    "word": "lesson",
    "phonetic": "/lesson/",
    "meaning": "课"
  },
  {
    "word": "subject",
    "phonetic": "/subject/",
    "meaning": "科目"
  },
  {
    "word": "test",
    "phonetic": "/test/",
    "meaning": "测试"
  },
  {
    "word": "exam",
    "phonetic": "/exam/",
    "meaning": "考试"
  },
  {
    "word": "homework",
    "phonetic": "/homework/",
    "meaning": "作业"
  },
  {
    "word": "study",
    "phonetic": "/study/",
    "meaning": "学习"
  },
  {
    "word": "learn",
    "phonetic": "/learn/",
    "meaning": "学习"
  },
  {
    "word": "know",
    "phonetic": "/know/",
    "meaning": "知道"
  },
  {
    "word": "understand",
    "phonetic": "/understand/",
    "meaning": "理解"
  },
  {
    "word": "remember",
    "phonetic": "/remember/",
    "meaning": "记得"
  },
  {
    "word": "forget",
    "phonetic": "/forget/",
    "meaning": "忘记"
  },
  {
    "word": "answer",
    "phonetic": "/answer/",
    "meaning": "回答"
  },
  {
    "word": "question",
    "phonetic": "/question/",
    "meaning": "问题"
  },
  {
    "word": "ask",
    "phonetic": "/ask/",
    "meaning": "问"
  },
  {
    "word": "help",
    "phonetic": "/help/",
    "meaning": "帮助"
  },
  {
    "word": "need",
    "phonetic": "/need/",
    "meaning": "需要"
  },
  {
    "word": "want",
    "phonetic": "/want/",
    "meaning": "想要"
  },
  {
    "word": "have",
    "phonetic": "/have/",
    "meaning": "有"
  },
  {
    "word": "has",
    "phonetic": "/has/",
    "meaning": "有"
  },
  {
    "word": "there",
    "phonetic": "/there/",
    "meaning": "那里"
  },
  {
    "word": "here",
    "phonetic": "/here/",
    "meaning": "这里"
  },
  {
    "word": "this",
    "phonetic": "/this/",
    "meaning": "这个"
  },
  {
    "word": "that",
    "phonetic": "/that/",
    "meaning": "那个"
  },
  {
    "word": "these",
    "phonetic": "/these/",
    "meaning": "这些"
  },
  {
    "word": "those",
    "phonetic": "/those/",
    "meaning": "那些"
  },
  {
    "word": "some",
    "phonetic": "/some/",
    "meaning": "一些"
  },
  {
    "word": "any",
    "phonetic": "/any/",
    "meaning": "任何"
  },
  {
    "word": "many",
    "phonetic": "/many/",
    "meaning": "许多"
  },
  {
    "word": "much",
    "phonetic": "/much/",
    "meaning": "许多"
  },
  {
    "word": "all",
    "phonetic": "/all/",
    "meaning": "所有"
  },
  {
    "word": "every",
    "phonetic": "/every/",
    "meaning": "每个"
  },
  {
    "word": "each",
    "phonetic": "/each/",
    "meaning": "每个"
  },
  {
    "word": "few",
    "phonetic": "/few/",
    "meaning": "少数"
  },
  {
    "word": "little",
    "phonetic": "/little/",
    "meaning": "少"
  },
  {
    "word": "more",
    "phonetic": "/more/",
    "meaning": "更多"
  },
  {
    "word": "less",
    "phonetic": "/less/",
    "meaning": "更少"
  },
  {
    "word": "most",
    "phonetic": "/most/",
    "meaning": "最多"
  },
  {
    "word": "least",
    "phonetic": "/least/",
    "meaning": "最少"
  },
  {
    "word": "first",
    "phonetic": "/first/",
    "meaning": "第一"
  },
  {
    "word": "second",
    "phonetic": "/second/",
    "meaning": "第二"
  },
  {
    "word": "third",
    "phonetic": "/third/",
    "meaning": "第三"
  },
  {
    "word": "fourth",
    "phonetic": "/fourth/",
    "meaning": "第四"
  },
  {
    "word": "fifth",
    "phonetic": "/fifth/",
    "meaning": "第五"
  },
  {
    "word": "last",
    "phonetic": "/last/",
    "meaning": "最后"
  },
  {
    "word": "next",
    "phonetic": "/next/",
    "meaning": "下一个"
  },
  {
    "word": "before",
    "phonetic": "/before/",
    "meaning": "在...之前"
  },
  {
    "word": "after",
    "phonetic": "/after/",
    "meaning": "在...之后"
  },
  {
    "word": "now",
    "phonetic": "/now/",
    "meaning": "现在"
  },
  {
    "word": "then",
    "phonetic": "/then/",
    "meaning": "然后"
  },
  {
    "word": "soon",
    "phonetic": "/soon/",
    "meaning": "很快"
  },
  {
    "word": "later",
    "phonetic": "/later/",
    "meaning": "稍后"
  },
  {
    "word": "early",
    "phonetic": "/early/",
    "meaning": "早"
  },
  {
    "word": "late",
    "phonetic": "/late/",
    "meaning": "晚"
  },
  {
    "word": "today",
    "phonetic": "/today/",
    "meaning": "今天"
  },
  {
    "word": "tomorrow",
    "phonetic": "/tomorrow/",
    "meaning": "明天"
  },
  {
    "word": "yesterday",
    "phonetic": "/yesterday/",
    "meaning": "昨天"
  },
  {
    "word": "week",
    "phonetic": "/week/",
    "meaning": "周"
  },
  {
    "word": "month",
    "phonetic": "/month/",
    "meaning": "月"
  },
  {
    "word": "year",
    "phonetic": "/year/",
    "meaning": "年"
  },
  {
    "word": "hour",
    "phonetic": "/hour/",
    "meaning": "小时"
  },
  {
    "word": "minute",
    "phonetic": "/minute/",
    "meaning": "分钟"
  },
  {
    "word": "second",
    "phonetic": "/second/",
    "meaning": "秒"
  },
  {
    "word": "day",
    "phonetic": "/day/",
    "meaning": "天"
  },
  {
    "word": "night",
    "phonetic": "/night/",
    "meaning": "夜晚"
  },
  {
    "word": "morning",
    "phonetic": "/morning/",
    "meaning": "早晨"
  },
  {
    "word": "afternoon",
    "phonetic": "/afternoon/",
    "meaning": "下午"
  },
  {
    "word": "evening",
    "phonetic": "/evening/",
    "meaning": "晚上"
  },
  {
    "word": "breakfast",
    "phonetic": "/breakfast/",
    "meaning": "早餐"
  },
  {
    "word": "lunch",
    "phonetic": "/lunch/",
    "meaning": "午餐"
  },
  {
    "word": "dinner",
    "phonetic": "/dinner/",
    "meaning": "晚餐"
  },
  {
    "word": "meal",
    "phonetic": "/meal/",
    "meaning": "餐"
  },
  {
    "word": "food",
    "phonetic": "/food/",
    "meaning": "食物"
  },
  {
    "word": "drink",
    "phonetic": "/drink/",
    "meaning": "喝"
  },
  {
    "word": "eat",
    "phonetic": "/eat/",
    "meaning": "吃"
  },
  {
    "word": "go",
    "phonetic": "/go/",
    "meaning": "去"
  },
  {
    "word": "come",
    "phonetic": "/come/",
    "meaning": "来"
  },
  {
    "word": "walk",
    "phonetic": "/walk/",
    "meaning": "走"
  },
  {
    "word": "run",
    "phonetic": "/run/",
    "meaning": "跑"
  },
  {
    "word": "jump",
    "phonetic": "/jump/",
    "meaning": "跳"
  },
  {
    "word": "swim",
    "phonetic": "/swim/",
    "meaning": "游泳"
  },
  {
    "word": "fly",
    "phonetic": "/fly/",
    "meaning": "飞"
  },
  {
    "word": "ride",
    "phonetic": "/ride/",
    "meaning": "骑"
  },
  {
    "word": "drive",
    "phonetic": "/drive/",
    "meaning": "驾驶"
  },
  {
    "word": "play",
    "phonetic": "/play/",
    "meaning": "玩"
  },
  {
    "word": "game",
    "phonetic": "/game/",
    "meaning": "游戏"
  },
  {
    "word": "sport",
    "phonetic": "/sport/",
    "meaning": "运动"
  },
  {
    "word": "football",
    "phonetic": "/football/",
    "meaning": "足球"
  },
  {
    "word": "basketball",
    "phonetic": "/basketball/",
    "meaning": "篮球"
  },
  {
    "word": "volleyball",
    "phonetic": "/volleyball/",
    "meaning": "排球"
  },
  {
    "word": "tennis",
    "phonetic": "/tennis/",
    "meaning": "网球"
  },
  {
    "word": "pingpong",
    "phonetic": "/pingpong/",
    "meaning": "乒乓球"
  },
  {
    "word": "baseball",
    "phonetic": "/baseball/",
    "meaning": "棒球"
  },
  {
    "word": "like",
    "phonetic": "/like/",
    "meaning": "喜欢"
  },
  {
    "word": "love",
    "phonetic": "/love/",
    "meaning": "爱"
  },
  {
    "word": "hate",
    "phonetic": "/hate/",
    "meaning": "讨厌"
  },
  {
    "word": "enjoy",
    "phonetic": "/enjoy/",
    "meaning": "享受"
  },
  {
    "word": "want",
    "phonetic": "/want/",
    "meaning": "想要"
  },
  {
    "word": "need",
    "phonetic": "/need/",
    "meaning": "需要"
  },
  {
    "word": "try",
    "phonetic": "/try/",
    "meaning": "尝试"
  },
  {
    "word": "do",
    "phonetic": "/do/",
    "meaning": "做"
  },
  {
    "word": "does",
    "phonetic": "/does/",
    "meaning": "做"
  },
  {
    "word": "did",
    "phonetic": "/did/",
    "meaning": "做"
  },
  {
    "word": "make",
    "phonetic": "/make/",
    "meaning": "制作"
  },
  {
    "word": "take",
    "phonetic": "/take/",
    "meaning": "拿"
  },
  {
    "word": "get",
    "phonetic": "/get/",
    "meaning": "得到"
  },
  {
    "word": "give",
    "phonetic": "/give/",
    "meaning": "给"
  },
  {
    "word": "send",
    "phonetic": "/send/",
    "meaning": "发送"
  },
  {
    "word": "receive",
    "phonetic": "/receive/",
    "meaning": "接收"
  },
  {
    "word": "buy",
    "phonetic": "/buy/",
    "meaning": "买"
  },
  {
    "word": "sell",
    "phonetic": "/sell/",
    "meaning": "卖"
  },
  {
    "word": "cost",
    "phonetic": "/cost/",
    "meaning": "花费"
  },
  {
    "word": "pay",
    "phonetic": "/pay/",
    "meaning": "支付"
  },
  {
    "word": "see",
    "phonetic": "/see/",
    "meaning": "看见"
  },
  {
    "word": "look",
    "phonetic": "/look/",
    "meaning": "看"
  },
  {
    "word": "watch",
    "phonetic": "/watch/",
    "meaning": "观看"
  },
  {
    "word": "read",
    "phonetic": "/read/",
    "meaning": "读"
  },
  {
    "word": "write",
    "phonetic": "/write/",
    "meaning": "写"
  },
  {
    "word": "draw",
    "phonetic": "/draw/",
    "meaning": "画"
  },
  {
    "word": "listen",
    "phonetic": "/listen/",
    "meaning": "听"
  },
  {
    "word": "hear",
    "phonetic": "/hear/",
    "meaning": "听见"
  },
  {
    "word": "speak",
    "phonetic": "/speak/",
    "meaning": "说"
  },
  {
    "word": "talk",
    "phonetic": "/talk/",
    "meaning": "谈话"
  },
  {
    "word": "say",
    "phonetic": "/say/",
    "meaning": "说"
  },
  {
    "word": "tell",
    "phonetic": "/tell/",
    "meaning": "告诉"
  },
  {
    "word": "think",
    "phonetic": "/think/",
    "meaning": "思考"
  },
  {
    "word": "know",
    "phonetic": "/know/",
    "meaning": "知道"
  },
  {
    "word": "understand",
    "phonetic": "/understand/",
    "meaning": "理解"
  },
  {
    "word": "learn",
    "phonetic": "/learn/",
    "meaning": "学习"
  },
  {
    "word": "study",
    "phonetic": "/study/",
    "meaning": "学习"
  },
  {
    "word": "teach",
    "phonetic": "/teach/",
    "meaning": "教"
  },
  {
    "word": "help",
    "phonetic": "/help/",
    "meaning": "帮助"
  },
  {
    "word": "ask",
    "phonetic": "/ask/",
    "meaning": "问"
  },
  {
    "word": "answer",
    "phonetic": "/answer/",
    "meaning": "回答"
  },
  {
    "word": "thank",
    "phonetic": "/thank/",
    "meaning": "谢谢"
  },
  {
    "word": "please",
    "phonetic": "/please/",
    "meaning": "请"
  },
  {
    "word": "sorry",
    "phonetic": "/sorry/",
    "meaning": "对不起"
  },
  {
    "word": "excuse",
    "phonetic": "/excuse/",
    "meaning": "原谅"
  },
  {
    "word": "hello",
    "phonetic": "/hello/",
    "meaning": "你好"
  },
  {
    "word": "hi",
    "phonetic": "/hi/",
    "meaning": "嗨"
  },
  {
    "word": "bye",
    "phonetic": "/bye/",
    "meaning": "再见"
  },
  {
    "word": "goodbye",
    "phonetic": "/goodbye/",
    "meaning": "再见"
  },
  {
    "word": "welcome",
    "phonetic": "/welcome/",
    "meaning": "欢迎"
  },
  {
    "word": "good",
    "phonetic": "/good/",
    "meaning": "好的"
  },
  {
    "word": "bad",
    "phonetic": "/bad/",
    "meaning": "坏的"
  },
  {
    "word": "nice",
    "phonetic": "/nice/",
    "meaning": "好的"
  },
  {
    "word": "fine",
    "phonetic": "/fine/",
    "meaning": "好的"
  },
  {
    "word": "great",
    "phonetic": "/great/",
    "meaning": "极好的"
  },
  {
    "word": "wonderful",
    "phonetic": "/wonderful/",
    "meaning": "精彩的"
  },
  {
    "word": "beautiful",
    "phonetic": "/beautiful/",
    "meaning": "美丽的"
  },
  {
    "word": "ugly",
    "phonetic": "/ugly/",
    "meaning": "丑陋的"
  },
  {
    "word": "big",
    "phonetic": "/big/",
    "meaning": "大的"
  },
  {
    "word": "small",
    "phonetic": "/small/",
    "meaning": "小的"
  },
  {
    "word": "large",
    "phonetic": "/large/",
    "meaning": "大的"
  },
  {
    "word": "huge",
    "phonetic": "/huge/",
    "meaning": "巨大的"
  },
  {
    "word": "little",
    "phonetic": "/little/",
    "meaning": "小的"
  },
  {
    "word": "tiny",
    "phonetic": "/tiny/",
    "meaning": "微小的"
  },
  {
    "word": "tall",
    "phonetic": "/tall/",
    "meaning": "高的"
  },
  {
    "word": "short",
    "phonetic": "/short/",
    "meaning": "矮的"
  },
  {
    "word": "long",
    "phonetic": "/long/",
    "meaning": "长的"
  },
  {
    "word": "wide",
    "phonetic": "/wide/",
    "meaning": "宽的"
  },
  {
    "word": "narrow",
    "phonetic": "/narrow/",
    "meaning": "窄的"
  },
  {
    "word": "thick",
    "phonetic": "/thick/",
    "meaning": "厚的"
  },
  {
    "word": "thin",
    "phonetic": "/thin/",
    "meaning": "薄的"
  },
  {
    "word": "heavy",
    "phonetic": "/heavy/",
    "meaning": "重的"
  },
  {
    "word": "light",
    "phonetic": "/light/",
    "meaning": "轻的"
  },
  {
    "word": "fast",
    "phonetic": "/fast/",
    "meaning": "快的"
  },
  {
    "word": "slow",
    "phonetic": "/slow/",
    "meaning": "慢的"
  },
  {
    "word": "hot",
    "phonetic": "/hot/",
    "meaning": "热的"
  },
  {
    "word": "cold",
    "phonetic": "/cold/",
    "meaning": "冷的"
  },
  {
    "word": "warm",
    "phonetic": "/warm/",
    "meaning": "温暖的"
  },
  {
    "word": "cool",
    "phonetic": "/cool/",
    "meaning": "凉爽的"
  },
  {
    "word": "wet",
    "phonetic": "/wet/",
    "meaning": "湿的"
  },
  {
    "word": "dry",
    "phonetic": "/dry/",
    "meaning": "干的"
  },
  {
    "word": "hard",
    "phonetic": "/hard/",
    "meaning": "硬的"
  },
  {
    "word": "soft",
    "phonetic": "/soft/",
    "meaning": "软的"
  },
  {
    "word": "new",
    "phonetic": "/new/",
    "meaning": "新的"
  },
  {
    "word": "old",
    "phonetic": "/old/",
    "meaning": "旧的"
  },
  {
    "word": "young",
    "phonetic": "/young/",
    "meaning": "年轻的"
  },
  {
    "word": "happy",
    "phonetic": "/happy/",
    "meaning": "快乐的"
  },
  {
    "word": "sad",
    "phonetic": "/sad/",
    "meaning": "悲伤的"
  },
  {
    "word": "angry",
    "phonetic": "/angry/",
    "meaning": "生气的"
  },
  {
    "word": "scared",
    "phonetic": "/scared/",
    "meaning": "害怕的"
  },
  {
    "word": "excited",
    "phonetic": "/excited/",
    "meaning": "兴奋的"
  },
  {
    "word": "tired",
    "phonetic": "/tired/",
    "meaning": "疲劳的"
  },
  {
    "word": "hungry",
    "phonetic": "/hungry/",
    "meaning": "饥饿的"
  },
  {
    "word": "thirsty",
    "phonetic": "/thirsty/",
    "meaning": "口渴的"
  },
  {
    "word": "full",
    "phonetic": "/full/",
    "meaning": "饱的"
  },
  {
    "word": "empty",
    "phonetic": "/empty/",
    "meaning": "空的"
  },
  {
    "word": "clean",
    "phonetic": "/clean/",
    "meaning": "干净的"
  },
  {
    "word": "dirty",
    "phonetic": "/dirty/",
    "meaning": "脏的"
  },
  {
    "word": "right",
    "phonetic": "/right/",
    "meaning": "正确的"
  },
  {
    "word": "wrong",
    "phonetic": "/wrong/",
    "meaning": "错误的"
  },
  {
    "word": "true",
    "phonetic": "/true/",
    "meaning": "真实的"
  },
  {
    "word": "false",
    "phonetic": "/false/",
    "meaning": "假的"
  },
  {
    "word": "same",
    "phonetic": "/same/",
    "meaning": "相同的"
  },
  {
    "word": "different",
    "phonetic": "/different/",
    "meaning": "不同的"
  },
  {
    "word": "easy",
    "phonetic": "/easy/",
    "meaning": "容易的"
  },
  {
    "word": "difficult",
    "phonetic": "/difficult/",
    "meaning": "困难的"
  },
  {
    "word": "simple",
    "phonetic": "/simple/",
    "meaning": "简单的"
  },
  {
    "word": "complex",
    "phonetic": "/complex/",
    "meaning": "复杂的"
  },
  {
    "word": "big",
    "phonetic": "/big/",
    "meaning": "大的"
  },
  {
    "word": "small",
    "phonetic": "/small/",
    "meaning": "小的"
  },
  {
    "word": "tall",
    "phonetic": "/tall/",
    "meaning": "高的"
  },
  {
    "word": "short",
    "phonetic": "/short/",
    "meaning": "短的"
  },
  {
    "word": "old",
    "phonetic": "/old/",
    "meaning": "年老的"
  },
  {
    "word": "young",
    "phonetic": "/young/",
    "meaning": "年轻的"
  },
  {
    "word": "happy",
    "phonetic": "/happy/",
    "meaning": "快乐的"
  },
  {
    "word": "sad",
    "phonetic": "/sad/",
    "meaning": "伤心的"
  },
  {
    "word": "good",
    "phonetic": "/good/",
    "meaning": "好的"
  },
  {
    "word": "bad",
    "phonetic": "/bad/",
    "meaning": "坏的"
  },
  {
    "word": "nice",
    "phonetic": "/nice/",
    "meaning": "美好的"
  },
  {
    "word": "kind",
    "phonetic": "/kind/",
    "meaning": "善良的"
  },
  {
    "word": "smart",
    "phonetic": "/smart/",
    "meaning": "聪明的"
  },
  {
    "word": "stupid",
    "phonetic": "/stupid/",
    "meaning": "愚蠢的"
  },
  {
    "word": "brave",
    "phonetic": "/brave/",
    "meaning": "勇敢的"
  },
  {
    "word": "afraid",
    "phonetic": "/afraid/",
    "meaning": "害怕的"
  },
  {
    "word": "hungry",
    "phonetic": "/hungry/",
    "meaning": "饥饿的"
  },
  {
    "word": "thirsty",
    "phonetic": "/thirsty/",
    "meaning": "口渴的"
  },
  {
    "word": "sleepy",
    "phonetic": "/sleepy/",
    "meaning": "困的"
  },
  {
    "word": "tired",
    "phonetic": "/tired/",
    "meaning": "累的"
  },
  {
    "word": "excited",
    "phonetic": "/excited/",
    "meaning": "兴奋的"
  },
  {
    "word": "bored",
    "phonetic": "/bored/",
    "meaning": "无聊的"
  },
  {
    "word": "angry",
    "phonetic": "/angry/",
    "meaning": "生气的"
  },
  {
    "word": "cute",
    "phonetic": "/cute/",
    "meaning": "可爱的"
  },
  {
    "word": "beautiful",
    "phonetic": "/beautiful/",
    "meaning": "美丽的"
  },
  {
    "word": "ugly",
    "phonetic": "/ugly/",
    "meaning": "丑陋的"
  },
  {
    "word": "strong",
    "phonetic": "/strong/",
    "meaning": "强壮的"
  },
  {
    "word": "weak",
    "phonetic": "/weak/",
    "meaning": "虚弱的"
  },
  {
    "word": "fast",
    "phonetic": "/fast/",
    "meaning": "快速的"
  },
  {
    "word": "slow",
    "phonetic": "/slow/",
    "meaning": "缓慢的"
  },
  {
    "word": "high",
    "phonetic": "/high/",
    "meaning": "高的"
  },
  {
    "word": "low",
    "phonetic": "/low/",
    "meaning": "低的"
  },
  {
    "word": "far",
    "phonetic": "/far/",
    "meaning": "远的"
  },
  {
    "word": "near",
    "phonetic": "/near/",
    "meaning": "近的"
  },
  {
    "word": "full",
    "phonetic": "/full/",
    "meaning": "满的"
  },
  {
    "word": "empty",
    "phonetic": "/empty/",
    "meaning": "空的"
  },
  {
    "word": "clean",
    "phonetic": "/clean/",
    "meaning": "干净的"
  },
  {
    "word": "dirty",
    "phonetic": "/dirty/",
    "meaning": "脏的"
  },
  {
    "word": "right",
    "phonetic": "/right/",
    "meaning": "右边的"
  },
  {
    "word": "left",
    "phonetic": "/left/",
    "meaning": "左边的"
  },
  {
    "word": "front",
    "phonetic": "/front/",
    "meaning": "前面的"
  },
  {
    "word": "back",
    "phonetic": "/back/",
    "meaning": "后面的"
  },
  {
    "word": "up",
    "phonetic": "/up/",
    "meaning": "向上的"
  },
  {
    "word": "down",
    "phonetic": "/down/",
    "meaning": "向下的"
  },
  {
    "word": "in",
    "phonetic": "/in/",
    "meaning": "在里面"
  },
  {
    "word": "out",
    "phonetic": "/out/",
    "meaning": "在外面"
  },
  {
    "word": "on",
    "phonetic": "/on/",
    "meaning": "在上面"
  },
  {
    "word": "under",
    "phonetic": "/under/",
    "meaning": "在下面"
  },
  {
    "word": "behind",
    "phonetic": "/behind/",
    "meaning": "在后面"
  },
  {
    "word": "between",
    "phonetic": "/between/",
    "meaning": "在中间"
  },
  {
    "word": "above",
    "phonetic": "/above/",
    "meaning": "在上方"
  },
  {
    "word": "below",
    "phonetic": "/below/",
    "meaning": "在下方"
  },
  {
    "word": "with",
    "phonetic": "/with/",
    "meaning": "和...一起"
  },
  {
    "word": "without",
    "phonetic": "/without/",
    "meaning": "没有"
  },
  {
    "word": "for",
    "phonetic": "/for/",
    "meaning": "为了"
  },
  {
    "word": "of",
    "phonetic": "/of/",
    "meaning": "...的"
  },
  {
    "word": "to",
    "phonetic": "/to/",
    "meaning": "到"
  },
  {
    "word": "and",
    "phonetic": "/and/",
    "meaning": "和"
  },
  {
    "word": "or",
    "phonetic": "/or/",
    "meaning": "或者"
  },
  {
    "word": "but",
    "phonetic": "/but/",
    "meaning": "但是"
  },
  {
    "word": "because",
    "phonetic": "/because/",
    "meaning": "因为"
  },
  {
    "word": "so",
    "phonetic": "/so/",
    "meaning": "所以"
  },
  {
    "word": "if",
    "phonetic": "/if/",
    "meaning": "如果"
  },
  {
    "word": "when",
    "phonetic": "/when/",
    "meaning": "当...时候"
  },
  {
    "word": "where",
    "phonetic": "/where/",
    "meaning": "在哪里"
  },
  {
    "word": "who",
    "phonetic": "/who/",
    "meaning": "谁"
  }
];

module.exports = primaryRealWords;