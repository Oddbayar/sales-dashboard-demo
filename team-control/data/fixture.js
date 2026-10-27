// «Багийн хяналт» demo fixture — the single source for every number on the page (summary, rows, task counts are computed from it).
// Demo only: reps SR-D0x and customers DM-xxxx are invented. Customer value profiles (cur, avg12, last) are borrowed from
// ui/rep-route/data/fixture.js (SR-073's customers, codes/names replaced). Products are names from ui/store-report.
// Rep plans and rep pack actuals are invented demo values. Edit freely; nothing else reads this file.
window.TEAM_CONTROL_FIXTURE = {
  "demo": true,
  "period": { "month": "2026-10", "cutoff": "2026-10-22", "avg12": ["2025-10", "2026-09"] },
  "supervisor": { "name": "Д.Оюун", "team": "Төв бүсийн баг" },
  "reps": [
    {"code":"SR-D01","name":"Б.Болд","plan":{"amount":33000000,"packs":4500},"packs_actual":2965},
    {"code":"SR-D02","name":"С.Сараа","plan":{"amount":34000000,"packs":3800},"packs_actual":1972},
    {"code":"SR-D03","name":"Т.Тэмүүжин","plan":{"amount":18000000,"packs":2500},"packs_actual":2423},
    {"code":"SR-D04","name":"Н.Номин","plan":{"amount":25000000,"packs":3100},"packs_actual":2362},
    {"code":"SR-D05","name":"Г.Ганаа","plan":{"amount":24000000,"packs":1800},"packs_actual":1835}
  ],
  "products": [
    {"sku":"SKU-0174","name":"Демо Зөөлөн Шал цэвэрлэгч Далайн сэвшээ 1 л"},
    {"sku":"SKU-0279","name":"Демо Нарлаг Шал цэвэрлэгч Мэдрэмтгий 2 л"},
    {"sku":"SKU-0194","name":"Демо Зөөлөн Аяга таваг угаагчийн таблет Эко 30 ш"},
    {"sku":"SKU-0165","name":"Демо Ая Чийгтэй салфетка Бактерийн эсрэг 72 ш"},
    {"sku":"SKU-0138","name":"Демо Ая Шүдний оо Ургамлын 75 г"},
    {"sku":"SKU-0043","name":"Демо Сэрүүн Угаалгын нунтаг Гар угаалга 3 кг"}
  ],
  "customers": [
    {"code":"DM-2101","name":"Хүслэн минимаркет","rep":"SR-D01","cur":3567981,"avg12":3567591,"last":"2026-10-22"},
    {"code":"DM-2102","name":"Өглөө минимаркет","rep":"SR-D01","cur":94900,"avg12":1468530,"last":"2026-10-21"},
    {"code":"DM-2103","name":"Нарлаг дэлгүүр","rep":"SR-D01","cur":0,"avg12":0,"last":"2023-07-04"},
    {"code":"DM-2104","name":"Тэмүүлэл минимаркет","rep":"SR-D01","cur":1209540,"avg12":2852332,"last":"2026-10-21"},
    {"code":"DM-2105","name":"Оргил дэлгүүр","rep":"SR-D01","cur":0,"avg12":136939,"last":"2026-05-27"},
    {"code":"DM-2106","name":"Саруул минимаркет","rep":"SR-D01","cur":1423970,"avg12":4024748,"last":"2026-10-21"},
    {"code":"DM-2107","name":"Энхжин минимаркет","rep":"SR-D01","cur":2695812,"avg12":6098333,"last":"2026-10-22"},
    {"code":"DM-2108","name":"Бүрэн минимаркет","rep":"SR-D01","cur":6435870,"avg12":5326868,"last":"2026-10-22"},
    {"code":"DM-2109","name":"Ивээл дэлгүүр","rep":"SR-D01","cur":1087280,"avg12":1040284,"last":"2026-10-16"},
    {"code":"DM-2110","name":"Цэцэглэг минимаркет","rep":"SR-D01","cur":650000,"avg12":2068770,"last":"2026-10-08"},
    {"code":"DM-2111","name":"Алтанзул минимаркет","rep":"SR-D01","cur":3049780,"avg12":4755589,"last":"2026-10-21"},
    {"code":"DM-2112","name":"Мөнхжин минимаркет","rep":"SR-D02","cur":4562258,"avg12":5381910,"last":"2026-10-22"},
    {"code":"DM-2113","name":"Тулга минимаркет","rep":"SR-D02","cur":2768995,"avg12":3956568,"last":"2026-10-21"},
    {"code":"DM-2114","name":"Өлзий дэлгүүр","rep":"SR-D02","cur":0,"avg12":0,"last":null},
    {"code":"DM-2115","name":"Есөн эрдэнэ дэлгүүр","rep":"SR-D02","cur":185600,"avg12":8107977,"last":"2026-10-14"},
    {"code":"DM-2116","name":"Сондор дэлгүүр","rep":"SR-D02","cur":0,"avg12":305965,"last":"2026-04-07"},
    {"code":"DM-2117","name":"Түмэн минимаркет","rep":"SR-D02","cur":216140,"avg12":743217,"last":"2026-10-21"},
    {"code":"DM-2118","name":"Гэрэлт минимаркет","rep":"SR-D02","cur":0,"avg12":874062,"last":"2026-09-30"},
    {"code":"DM-2119","name":"Хангай минимаркет","rep":"SR-D02","cur":504160,"avg12":2095003,"last":"2026-10-21"},
    {"code":"DM-2120","name":"Мандал минимаркет","rep":"SR-D02","cur":6626671,"avg12":6632368,"last":"2026-10-20"},
    {"code":"DM-2121","name":"Ундрал дэлгүүр","rep":"SR-D02","cur":920680,"avg12":1365693,"last":"2026-10-22"},
    {"code":"DM-2122","name":"Шинэ зам минимаркет","rep":"SR-D03","cur":1982300,"avg12":3455689,"last":"2026-10-21"},
    {"code":"DM-2123","name":"Бадрал минимаркет","rep":"SR-D03","cur":6630650,"avg12":5666448,"last":"2026-10-15"},
    {"code":"DM-2124","name":"Тэнгис минимаркет","rep":"SR-D03","cur":669540,"avg12":759119,"last":"2026-10-21"},
    {"code":"DM-2125","name":"Хөх тэнгэр минимаркет","rep":"SR-D03","cur":3618190,"avg12":2212519,"last":"2026-10-20"},
    {"code":"DM-2126","name":"Их наран минимаркет","rep":"SR-D03","cur":2405180,"avg12":1990323,"last":"2026-10-22"},
    {"code":"DM-2127","name":"Номт минимаркет","rep":"SR-D03","cur":0,"avg12":0,"last":null},
    {"code":"DM-2128","name":"Цагаан дэл минимаркет","rep":"SR-D03","cur":2803783,"avg12":3796639,"last":"2026-10-21"},
    {"code":"DM-2129","name":"Зүүн хүрээ минимаркет","rep":"SR-D03","cur":0,"avg12":0,"last":"2023-09-21"},
    {"code":"DM-2130","name":"Баян дэлгүүр","rep":"SR-D03","cur":472140,"avg12":1764746,"last":"2026-10-21"},
    {"code":"DM-2131","name":"Сайхан минимаркет","rep":"SR-D03","cur":0,"avg12":0,"last":"2023-11-22"},
    {"code":"DM-2132","name":"Од минимаркет","rep":"SR-D04","cur":6947650,"avg12":3554068,"last":"2026-10-21"},
    {"code":"DM-2133","name":"Билгүүн минимаркет","rep":"SR-D04","cur":248730,"avg12":2467483,"last":"2026-10-10"},
    {"code":"DM-2134","name":"Нүүдэл минимаркет","rep":"SR-D04","cur":1897306,"avg12":2371666,"last":"2026-10-22"},
    {"code":"DM-2135","name":"Таван толгой дэлгүүр","rep":"SR-D04","cur":7300,"avg12":739640,"last":"2026-10-14"},
    {"code":"DM-2136","name":"Заан минимаркет","rep":"SR-D04","cur":3334940,"avg12":7308485,"last":"2026-10-20"},
    {"code":"DM-2137","name":"Хэрлэн минимаркет","rep":"SR-D04","cur":2844590,"avg12":2952185,"last":"2026-10-21"},
    {"code":"DM-2138","name":"Туул минимаркет","rep":"SR-D04","cur":21900,"avg12":911956,"last":"2026-10-13"},
    {"code":"DM-2139","name":"Сэлэнгэ гол минимаркет","rep":"SR-D04","cur":2049300,"avg12":3672012,"last":"2026-10-18"},
    {"code":"DM-2140","name":"Дөл минимаркет","rep":"SR-D04","cur":0,"avg12":61478,"last":"2026-06-23"},
    {"code":"DM-2141","name":"Эрдэм минимаркет","rep":"SR-D04","cur":38880,"avg12":1329385,"last":"2026-10-14"},
    {"code":"DM-2142","name":"Хаан минимаркет","rep":"SR-D05","cur":0,"avg12":1042604,"last":"2026-04-30"},
    {"code":"DM-2143","name":"Цогт минимаркет","rep":"SR-D05","cur":415820,"avg12":2317649,"last":"2026-10-16"},
    {"code":"DM-2144","name":"Мишээл минимаркет","rep":"SR-D05","cur":2777525,"avg12":4896307,"last":"2026-10-15"},
    {"code":"DM-2145","name":"Жаргалан дэлгүүр","rep":"SR-D05","cur":741700,"avg12":850356,"last":"2026-10-17"},
    {"code":"DM-2146","name":"Уртын дуу минимаркет","rep":"SR-D05","cur":1040530,"avg12":2006206,"last":"2026-10-21"},
    {"code":"DM-2147","name":"Ирээдүй минимаркет","rep":"SR-D05","cur":1134360,"avg12":922412,"last":"2026-10-13"},
    {"code":"DM-2148","name":"Шижир минимаркет","rep":"SR-D05","cur":3438802,"avg12":4267102,"last":"2026-10-21"},
    {"code":"DM-2149","name":"Сүлд минимаркет","rep":"SR-D05","cur":1816130,"avg12":1517784,"last":"2026-10-20"},
    {"code":"DM-2150","name":"Онгон минимаркет","rep":"SR-D05","cur":1627250,"avg12":2640522,"last":"2026-10-21"}
  ],
  "tasks": [
    {"id":"T-0003","type":"placement","title":"Демо Зөөлөн Шал цэвэрлэгч Далайн сэвшээ 1 л — байршуулалт","created":"2026-10-19","due":"2026-10-31","sku":"SKU-0174","min_qty":3,"note":"Тавиурын нүдний түвшинд байрлуулна.","items":[{"customer":"DM-2101","status":"todo"},{"customer":"DM-2102","status":"todo"},{"customer":"DM-2103","status":"review"},{"customer":"DM-2104","status":"done"},{"customer":"DM-2122","status":"todo"},{"customer":"DM-2123","status":"review"},{"customer":"DM-2124","status":"todo"}]},
    {"id":"T-0002","type":"general","title":"Үнийн шошго шинэчлэх","created":"2026-10-12","due":"2026-10-24","body":"10-р сарын шинэ үнийн шошгыг тавиур дээр солиод зураг илгээнэ.","items":[{"customer":"DM-2132","status":"done"},{"customer":"DM-2133","status":"done"},{"customer":"DM-2134","status":"review"},{"customer":"DM-2135","status":"done"},{"customer":"DM-2136","status":"review"}]},
    {"id":"T-0001","type":"placement","title":"Демо Зөөлөн Аяга таваг угаагчийн таблет Эко 30 ш — байршуулалт","created":"2026-10-05","due":"2026-10-20","sku":"SKU-0194","min_qty":2,"note":"","items":[{"customer":"DM-2114","status":"done"},{"customer":"DM-2115","status":"done"},{"customer":"DM-2116","status":"done"},{"customer":"DM-2142","status":"review"},{"customer":"DM-2143","status":"done"},{"customer":"DM-2144","status":"done"}]}
  ],
  // ↑ "tasks" is the Claude 28 (v1) shape, kept unchanged; the page converts it to plain text with the same function it uses
  //   for v1 browser storage. These have no event history, and none is invented.
  // ↓ Claude 29 shape: one plain-text task source + one assignment per customer (own rep, status, rev and append-only
  //   history). Status always follows the last event: assigned/rework → todo, reply → review, confirm → done, close_failed → failed.
  //   Replies are demo examples; there is no rep reply page yet.
  "v2": {
    "tasks": [
      {"id":"FX-01","title":"Шинэ бүтээгдэхүүн санал болгох","created_at":"2026-10-20T09:30:00+08:00","due":"2026-10-30","text":"«Демо Нарлаг Шал цэвэрлэгч Мэдрэмтгий 2 л»-ийг харилцагч бүрд санал болгож, 3+ ширхэг байршуулсан эсэх болон аваагүй шалтгааныг тэмдэглэнэ."},
      {"id":"FX-02","title":"Шинэ үнийн шошго байрлуулах","created_at":"2026-10-21T09:00:00+08:00","due":"2026-10-25","text":"10-р сарын шинэ үнийн шошгыг бүх тавиурт байрлуулж, тавиурын зургийг илгээнэ."},
      {"id":"FX-03","title":"Тавиурын зураг илгээх","created_at":"2026-10-23T10:00:00+08:00","due":"2026-10-28","text":"Угаалгын нунтгийн тавиурыг урд талаас нь нэг зургаар авч, үнийн шошго харагдаж байгааг шалгаад илгээнэ."},
      {"id":"FX-04","title":"Үлдэгдэл төлбөрийн уулзалт","created_at":"2026-10-26T08:45:00+08:00","due":"2026-11-05","text":"Харилцагчтай уулзаж 9-р сарын үлдэгдэл төлбөрийн хуваарийг тохиролцоод, тохирсон огноог хариунд бичнэ."}
    ],
    "assignments": [
      {"id":"FX-01:DM-2106","task":"FX-01","customer":"DM-2106","rep":"SR-D01","status":"review","rev":2,"history":[
        {"at":"2026-10-20T09:30:00+08:00","by":"supervisor","kind":"assigned"},
        {"at":"2026-10-24T15:10:00+08:00","by":"rep","kind":"reply","result":"done","text":"4 ш байршуулсан, тавиурын 2-р давхарт. Зургийг илгээсэн."}]},
      {"id":"FX-01:DM-2107","task":"FX-01","customer":"DM-2107","rep":"SR-D01","status":"review","rev":2,"history":[
        {"at":"2026-10-20T09:30:00+08:00","by":"supervisor","kind":"assigned"},
        {"at":"2026-10-23T11:40:00+08:00","by":"rep","kind":"reply","result":"not_done","text":"Санал болгосон, авсангүй.","reason":"Агуулах дүүрэн, 11-р сард авна гэсэн."}]},
      {"id":"FX-01:DM-2108","task":"FX-01","customer":"DM-2108","rep":"SR-D01","status":"done","rev":3,"history":[
        {"at":"2026-10-20T09:30:00+08:00","by":"supervisor","kind":"assigned"},
        {"at":"2026-10-22T16:05:00+08:00","by":"rep","kind":"reply","result":"done","text":"6 ш байршуулсан."},
        {"at":"2026-10-23T10:00:00+08:00","by":"supervisor","kind":"confirm","comment":"Зургаар шалгасан."}]},
      {"id":"FX-01:DM-2109","task":"FX-01","customer":"DM-2109","rep":"SR-D01","status":"todo","rev":1,"history":[
        {"at":"2026-10-20T09:30:00+08:00","by":"supervisor","kind":"assigned"}]},
      {"id":"FX-01:DM-2113","task":"FX-01","customer":"DM-2113","rep":"SR-D02","status":"todo","rev":3,"history":[
        {"at":"2026-10-20T09:30:00+08:00","by":"supervisor","kind":"assigned"},
        {"at":"2026-10-21T13:20:00+08:00","by":"rep","kind":"reply","result":"done","text":"3 ш байршуулсан."},
        {"at":"2026-10-22T09:15:00+08:00","by":"supervisor","kind":"rework","comment":"Зураг бүдэг, бараа харагдахгүй байна. Дахин зураг авч илгээнэ үү."}]},
      {"id":"FX-01:DM-2119","task":"FX-01","customer":"DM-2119","rep":"SR-D02","status":"failed","rev":3,"history":[
        {"at":"2026-10-20T09:30:00+08:00","by":"supervisor","kind":"assigned"},
        {"at":"2026-10-24T12:30:00+08:00","by":"rep","kind":"reply","result":"not_done","text":"Уулзаж чадсангүй.","reason":"Эзэн нь хөдөө явсан, 2 удаа очсон."},
        {"at":"2026-10-25T09:40:00+08:00","by":"supervisor","kind":"close_failed","comment":"Шалтгааныг зөвшөөрөв. Дараагийн сарын төлөвлөгөөнд оруулна."}]},
      {"id":"FX-02:DM-2132","task":"FX-02","customer":"DM-2132","rep":"SR-D04","status":"review","rev":4,"history":[
        {"at":"2026-10-21T09:00:00+08:00","by":"supervisor","kind":"assigned"},
        {"at":"2026-10-22T17:45:00+08:00","by":"rep","kind":"reply","result":"done","text":"Шошгыг сольсон."},
        {"at":"2026-10-23T08:50:00+08:00","by":"supervisor","kind":"rework","comment":"Хоёр бараан дээр шошго дутуу байна."},
        {"at":"2026-10-24T14:05:00+08:00","by":"rep","kind":"reply","result":"done","text":"Дутуу хоёр шошгыг нэмж, зургийг дахин илгээсэн."}]},
      {"id":"FX-02:DM-2104","task":"FX-02","customer":"DM-2104","rep":"SR-D01","status":"done","rev":5,"history":[
        {"at":"2026-10-21T09:00:00+08:00","by":"supervisor","kind":"assigned"},
        {"at":"2026-10-22T11:00:00+08:00","by":"rep","kind":"reply","result":"done","text":"Сольсон."},
        {"at":"2026-10-23T09:05:00+08:00","by":"supervisor","kind":"rework","comment":"Зураг алга. Зургаа хавсаргана уу."},
        {"at":"2026-10-24T10:30:00+08:00","by":"rep","kind":"reply","result":"done","text":"Зургийг хавсаргалаа."},
        {"at":"2026-10-25T08:30:00+08:00","by":"supervisor","kind":"confirm"}]},
      {"id":"FX-03:DM-2125","task":"FX-03","customer":"DM-2125","rep":"SR-D03","status":"review","rev":2,"history":[
        {"at":"2026-10-23T10:00:00+08:00","by":"supervisor","kind":"assigned"},
        {"at":"2026-10-25T09:20:00+08:00","by":"rep","kind":"reply","result":"done","text":"Зургийг илгээсэн, шошго бүгд харагдаж байна."}]},
      {"id":"FX-03:DM-2126","task":"FX-03","customer":"DM-2126","rep":"SR-D03","status":"done","rev":3,"history":[
        {"at":"2026-10-23T10:00:00+08:00","by":"supervisor","kind":"assigned"},
        {"at":"2026-10-24T16:10:00+08:00","by":"rep","kind":"reply","result":"done","text":"Илгээсэн."},
        {"at":"2026-10-26T11:20:00+08:00","by":"supervisor","kind":"confirm","comment":"Зөв."}]},
      {"id":"FX-03:DM-2137","task":"FX-03","customer":"DM-2137","rep":"SR-D04","status":"review","rev":2,"history":[
        {"at":"2026-10-23T10:00:00+08:00","by":"supervisor","kind":"assigned"},
        {"at":"2026-10-24T17:05:00+08:00","by":"rep","kind":"reply","result":"done","text":"Зураг илгээсэн. Нэг шошго урагдсан байсныг сольсон."}]},
      {"id":"FX-03:DM-2145","task":"FX-03","customer":"DM-2145","rep":"SR-D05","status":"todo","rev":1,"history":[
        {"at":"2026-10-23T10:00:00+08:00","by":"supervisor","kind":"assigned"}]},
      {"id":"FX-03:DM-2146","task":"FX-03","customer":"DM-2146","rep":"SR-D05","status":"review","rev":2,"history":[
        {"at":"2026-10-23T10:00:00+08:00","by":"supervisor","kind":"assigned"},
        {"at":"2026-10-26T12:00:00+08:00","by":"rep","kind":"reply","result":"not_done","text":"Зураг авч чадсангүй.","reason":"Дэлгүүр засвартай, 10.29-нд нээгдэнэ."}]},
      {"id":"FX-04:DM-2115","task":"FX-04","customer":"DM-2115","rep":"SR-D02","status":"todo","rev":1,"history":[
        {"at":"2026-10-26T08:45:00+08:00","by":"supervisor","kind":"assigned"}]},
      {"id":"FX-04:DM-2116","task":"FX-04","customer":"DM-2116","rep":"SR-D02","status":"todo","rev":1,"history":[
        {"at":"2026-10-26T08:45:00+08:00","by":"supervisor","kind":"assigned"}]},
      {"id":"FX-04:DM-2142","task":"FX-04","customer":"DM-2142","rep":"SR-D05","status":"review","rev":2,"history":[
        {"at":"2026-10-26T08:45:00+08:00","by":"supervisor","kind":"assigned"},
        {"at":"2026-10-26T16:40:00+08:00","by":"rep","kind":"reply","result":"done","text":"11.03, 11.17-нд хоёр хувааж төлөхөөр тохирсон."}]}
    ]
  }
};
