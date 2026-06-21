-- Upsert the current action library prompts into public.material_slot_definitions.
-- Run with the Supabase SQL editor or a service-role database connection.

with material_prompts (
  slot,
  name,
  group_id,
  trigger_label,
  duration_seconds,
  credit_rate_per_second,
  prompt_template,
  sort_order
) as (
  values
    (
      'idle_loop',
      '待机循环',
      'core',
      '默认循环',
      10,
      1.80,
      '固定摄像机视角，小猫舔爪子并发出可爱叫声，歪头看着镜头，左右看，打个哈欠，呆萌呆萌的，视频自然循环',
      0
    ),
    (
      'sleep_loop',
      '睡觉',
      'core',
      '长时间无操作',
      8,
      1.75,
      '固定摄像机视角，小猫趴着睡觉，眼睛闭上，肚子轻轻起伏，安静治愈，视频自然循环',
      1
    ),
    (
      'catch_bug',
      '鼠标经过抓虫子',
      'pointer',
      '鼠标经过宠物',
      5,
      2.40,
      '固定摄像机视角，小虫子从面前飞过，小猫盯着虫子，抬爪扑抓，反应灵敏可爱，视频自然循环',
      2
    ),
    (
      'catch_bug_up',
      '双手抓上方虫子',
      'pointer',
      '鼠标经过宠物',
      5,
      2.40,
      '固定摄像机视角，小虫子在头顶飞过，小猫抬起双爪向上抓虫子，呆萌认真，视频自然循环',
      3
    ),
    (
      'click_react',
      '点击反应',
      'pointer',
      '点击宠物',
      4,
      3.00,
      '固定摄像机视角，小猫被轻轻点一下，眨眼抬头看镜头，伸爪子抓一下几摸一下镜头，歪头卖萌，视频自然循环',
      4
    ),
    (
      'head_rub_left',
      '左边头蹭蹭',
      'nearbyPet',
      '另一只宠物靠近',
      5,
      2.40,
      '固定摄像机视角，小猫把头伸向左边，用脸颊轻轻蹭左边，眯眼撒娇，软萌可爱，视频自然循环',
      5
    ),
    (
      'head_rub_right',
      '右边头蹭蹭',
      'nearbyPet',
      '另一只宠物靠近',
      5,
      2.40,
      '固定摄像机视角，小猫把头伸向右边，用脸颊轻轻蹭右边，尾巴轻轻摇，粘人可爱，视频自然循环',
      6
    ),
    (
      'angry_swipe_left',
      '向左看生气挥一下爪子',
      'nearbyPet',
      '另一只宠物靠近',
      5,
      2.40,
      '固定摄像机视角，小猫向左看，生气，挥一下小爪子，奶凶可爱，视频自然循环',
      7
    ),
    (
      'angry_swipe_right',
      '向右看生气挥一下爪子',
      'nearbyPet',
      '另一只宠物靠近',
      5,
      2.40,
      '固定摄像机视角，小猫向右看，生气，挥一下小爪子，奶凶可爱，视频自然循环',
      8
    ),
    (
      'yawn',
      '打哈欠',
      'idleLife',
      '待机随机',
      6,
      1.66,
      '固定摄像机视角，小猫困困地打个哈欠，眯眼伸舌头，软萌可爱，视频自然循环',
      9
    ),
    (
      'lick_belly',
      '舔肚子的毛',
      'idleLife',
      '待机随机',
      8,
      1.25,
      '固定摄像机视角，小猫低头舔肚子上的毛，动作自然，乖巧可爱，视频自然循环',
      10
    ),
    (
      'lick_back',
      '舔背部的毛',
      'idleLife',
      '待机随机',
      8,
      1.25,
      '固定摄像机视角，小猫转头舔背部的毛，尾巴轻轻摆动，慵懒可爱，视频自然循环',
      11
    ),
    (
      'stretch',
      '伸懒腰',
      'idleLife',
      '待机随机',
      6,
      1.66,
      '固定摄像机视角，小猫前爪伸直，屁股翘起伸懒腰，打个小哈欠，视频自然循环',
      12
    ),
    (
      'happy',
      '开心',
      'idleLife',
      '待机随机',
      6,
      1.66,
      '固定摄像机视角，小猫开心摇尾巴，眼睛亮亮的，看着镜头蹭蹭卖萌，视频自然循环',
      13
    ),
    (
      'disgusted',
      '嫌弃',
      'idleLife',
      '待机随机',
      5,
      2.00,
      '固定摄像机视角，小猫露出嫌弃表情，眯眼撇头，轻轻后退一步，视频自然循环',
      14
    ),
    (
      'clingy',
      '粘人',
      'idleLife',
      '待机随机',
      6,
      1.66,
      '固定摄像机视角，小猫靠近镜头蹭蹭撒娇，尾巴轻轻摇，超级粘人，视频自然循环',
      15
    ),
    (
      'aloof',
      '高冷',
      'idleLife',
      '待机随机',
      5,
      2.00,
      '固定摄像机视角，小猫高冷坐着，淡淡看一眼镜头，慢慢转头不理人，视频自然循环',
      16
    ),
    (
      'belly_up',
      '躺下翻肚皮',
      'idleLife',
      '待机随机',
      7,
      1.42,
      '固定摄像机视角，小猫慢慢躺下，翻出软软肚皮，四爪微微蜷着，撒娇可爱，视频自然循环',
      17
    ),
    (
      'look_at_camera',
      '看镜头',
      'idleLife',
      '待机随机',
      6,
      1.66,
      '固定摄像机视角，小猫身体微微前倾，脸部非常靠近镜头，大眼睛盯着镜头，好奇地左右歪头，鼻子轻轻凑近像在嗅探，表情呆萌可爱，轻微点头和探头动作，近距离鱼眼镜头，视频自然循环',
      18
    ),
    (
      'salary_cat_stinky_dance',
      '跳月薪喵散屁舞',
      'idleLife',
      '待机随机',
      6,
      1.66,
      '固定摄像机视角，小猫跳散味舞，一只爪子捂鼻子、另一只爪子左右扇空气、身体左右摇摆、轻微弹跳，表情呆萌可爱，保持节奏同步，视频自然循环',
      19
    ),
    (
      'head_bob_dance',
      '摇头晃脑舞',
      'idleLife',
      '待机随机',
      6,
      1.66,
      '固定摄像机视角，小猫跳网红摇头晃脑舞，身体正面对着镜头，脑袋随着音乐节奏左右摇摆，表情呆萌可爱，保持节奏同步，视频自然循环',
      20
    ),
    (
      'full_wash_face',
      '吃饱满足洗脸',
      'feeding',
      '吃饱后触发',
      8,
      1.25,
      '固定摄像机视角，小猫吃饱后满足眯眼，用爪子慢慢洗脸，幸福可爱，视频自然循环',
      21
    ),
    (
      'hungry_meow',
      '饿了嗷嗷叫',
      'feeding',
      '饥饿时触发',
      6,
      1.66,
      '固定摄像机视角，小猫肚子饿了，抬头对着镜头嗷嗷叫，委屈可爱，视频自然循环',
      22
    )
)
insert into public.material_slot_definitions (
  slot,
  name,
  group_id,
  trigger_label,
  trigger_is_editable,
  duration_seconds,
  credit_rate_per_second,
  prompt_template,
  generation_settings,
  is_enabled,
  sort_order,
  updated_at
)
select
  slot,
  name,
  group_id,
  trigger_label,
  false,
  duration_seconds,
  credit_rate_per_second,
  prompt_template,
  jsonb_build_object(
    'model', 'doubao-seedance-2-0-fast-260128',
    'durationSeconds', duration_seconds,
    'ratio', 'adaptive',
    'resolution', '720p',
    'framesPerSecond', 24,
    'cameraFixed', true,
    'watermark', false,
    'generateAudio', false,
    'returnLastFrame', true
  ),
  true,
  sort_order,
  now()
from material_prompts
on conflict (slot) do update set
  name = excluded.name,
  group_id = excluded.group_id,
  trigger_label = excluded.trigger_label,
  trigger_is_editable = excluded.trigger_is_editable,
  duration_seconds = excluded.duration_seconds,
  credit_rate_per_second = excluded.credit_rate_per_second,
  prompt_template = excluded.prompt_template,
  generation_settings = excluded.generation_settings,
  is_enabled = excluded.is_enabled,
  sort_order = excluded.sort_order,
  updated_at = excluded.updated_at;

update public.material_slot_definitions
set sort_order = 23,
    updated_at = now()
where slot = 'drag_loop';
