#!/usr/bin/env python3
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json, math

W,H=1080,1350
BG=(248,246,242); WHITE=(255,255,255); BLACK=(20,20,20); GRAY=(102,102,102)
LIGHT=(231,227,220); ORANGE=(255,92,0); DARK=(35,35,35)
OUT=Path("media/instagram/2026-10")

POSTS=[
("01-diagnostics",6,"Диагностика без лишней переписки","Выберите сервис и запишитесь онлайн без длинных переписок.","Записаться",["Выберите вид диагностики","Сравните доступные варианты","Подтвердите удобное время"],["Укажите автомобиль","Выберите диагностику","Подтвердите запись"],"Не нужно объяснять проблему в десятке чатов. В KARETA.KZ можно выбрать диагностику, автомобиль и удобное время записи в одном сценарии.","#KARETAKZ #диагностикаавто #автосервис #ремонтавто","diagnostics"),
("02-find-master",5,"Найди мастера без десятков звонков","Выберите услугу, посмотрите варианты и найдите подходящего мастера.","Найти мастера",["Поиск по нужной услуге","Мастера и СТО рядом","Понятная карточка специалиста"],["Выберите услугу","Посмотрите варианты","Выберите мастера"],"Вместо звонков по объявлениям — единый поиск мастеров и СТО по нужной услуге. Смотрите варианты и выбирайте того, кто подходит именно вам.","#KARETAKZ #автомастер #СТО #автосервис","master"),
("03-car-control",6,"Автомобиль под контролем","Сервис, обслуживание и полезная информация по автомобилю — в одном месте.","Открыть KARETA.KZ",["История обслуживания","Напоминания по автомобилю","Сервис и запчасти рядом"],["Добавьте автомобиль","Сохраняйте обслуживание","Возвращайтесь к истории"],"Один профиль автомобиля вместо заметок, переписок и потерянных чеков. KARETA.KZ собирает ключевые действия вокруг вашей машины в одном интерфейсе.","#KARETAKZ #мойавтомобиль #автосервис #автоприложение","car"),
("04-service-booking",4,"Запись на сервис за пару минут","Выберите услугу, дату и удобное время.","Записаться",["Нужная услуга","Дата и время","Подходящее СТО"],["Выберите услугу","Выберите слот","Подтвердите запись"],"Запись на сервис должна быть такой же понятной, как обычное бронирование. Выбираете услугу, время и подтверждаете запись.","#KARETAKZ #записьнасервис #СТО #ремонтавто","calendar"),
("05-repair-prices",6,"Понятные цены на ремонт","Сравнивайте предложения до того, как подтвердите работу.","Смотреть варианты",["Сравнение предложений","Стоимость до записи","Понятный состав работ"],["Опишите задачу","Получите предложения","Сравните условия"],"Цена должна быть понятна до начала работ. В KARETA.KZ можно сравнить варианты и выбрать подходящее предложение по услуге.","#KARETAKZ #ценаремонта #автосервис #ремонтавто","brake"),
("06-parts",4,"Запчасти в одном месте","Ищите детали под свой автомобиль и сравнивайте варианты.","Найти запчасти",["Подбор под автомобиль","Оригиналы и аналоги","Поставщики в одном разделе"],["Выберите автомобиль","Укажите деталь","Сравните варианты"],"Нужная деталь — без бесконечного поиска по разным площадкам. Подбор запчастей строится вокруг вашего автомобиля и конкретной задачи.","#KARETAKZ #автозапчасти #запчасти #автомобиль","parts"),
("07-auto-electrician",5,"Автоэлектрик рядом","Найдите специалиста по электрике и диагностике автомобиля.","Найти электрика",["Электрика и электроника","Компьютерная диагностика","Специалисты рядом"],["Выберите проблему","Посмотрите специалистов","Запишитесь"],"Ошибки, датчики, проводка, запуск, зарядка — для таких задач нужен профильный специалист. KARETA.KZ помогает найти автоэлектрика под конкретную работу.","#KARETAKZ #автоэлектрик #диагностика #ремонтавто","electric"),
("08-oil-reminder",6,"Не пропускайте замену масла","Напоминание по обслуживанию помогает вовремя запланировать сервис.","Запланировать",["Контроль пробега","Напоминание о сроке","Запись на обслуживание"],["Добавьте автомобиль","Укажите обслуживание","Получите напоминание"],"Техобслуживание проще планировать заранее. Сохраняйте данные автомобиля и возвращайтесь к следующему обслуживанию без лишних заметок.","#KARETAKZ #заменамасла #ТО #обслуживаниеавто","oil"),
("09-service-history",3,"История обслуживания автомобиля","Работы, даты и документы по машине остаются в одном профиле.","Открыть историю",["Выполненные работы","Даты и пробег","Чеки и записи"],["Записывайте работы","Храните историю","Используйте при следующем ТО"],"История обслуживания помогает понимать, что уже делали с автомобилем и что планировать дальше. Все записи — в профиле автомобиля.","#KARETAKZ #историяавто #ТО #автосервис","history"),
("10-road-help",3,"Эвакуатор и помощь в пути","Нужная помощь, когда автомобиль не может продолжать движение.","Вызвать помощь",["Данные автомобиля","Местоположение","Подходящий тип помощи"],["Укажите ситуацию","Передайте точку","Выберите помощь"],"Если машина остановилась в дороге, важен понятный сценарий без лишних действий: что случилось, где вы находитесь и какая помощь нужна.","#KARETAKZ #эвакуатор #помощьвпути #авто","tow"),
("11-sto-map",5,"Подбор СТО рядом","Смотрите сервисы на карте и выбирайте подходящий вариант.","Показать на карте",["Карта сервисов","Отзывы и карточки","Расстояние до СТО"],["Откройте карту","Выберите сервис","Перейдите к записи"],"Когда важна близость, проще выбирать сервис прямо на карте. Смотрите доступные СТО, карточки и переходите к записи.","#KARETAKZ #СТОрядом #автосервис #карта","map"),
("12-all-in-one",6,"Один сервис для авто, мастера и запчастей","Все ключевые сценарии вокруг автомобиля объединены в KARETA.KZ.","Открыть KARETA.KZ",["Сервисы и мастера","Запчасти","История автомобиля"],["Добавьте авто","Выберите нужный сценарий","Решайте задачу в одном сервисе"],"KARETA.KZ объединяет основные автомобильные задачи: поиск мастера, запись на сервис, запчасти и историю обслуживания автомобиля.","#KARETAKZ #автосервис #автозапчасти #автомобиль","all")
]

BOLD="/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Bold.ttf"
REG="/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
def F(s,b=False): return ImageFont.truetype(BOLD if b else REG,s)
BRAND=F(34,True); TITLE=F(76,True); SUB=F(35); SMALL=F(27); CTA=F(34,True)

def rr(d,xy,r,fill,outline=None,width=1): d.rounded_rectangle(xy,radius=r,fill=fill,outline=outline,width=width)
def wrap(d,t,font,mw):
    out=[]; cur=""
    for w in t.split():
        z=(cur+" "+w).strip()
        if d.textlength(z,font=font)<=mw: cur=z
        else:
            if cur: out.append(cur)
            cur=w
    if cur: out.append(cur)
    return out
def block(d,t,x,y,font,fill,mw,g=8,ml=None):
    lines=wrap(d,t,font,mw)
    if ml: lines=lines[:ml]
    bb=d.textbbox((0,0),"Ag",font=font); lh=bb[3]-bb[1]
    for ln in lines:
        d.text((x,y),ln,font=font,fill=fill); y+=lh+g
    return y
def brand(d,n,dark=False):
    fg=WHITE if dark else BLACK
    d.line((64,80,88,52),fill=ORANGE,width=9); d.line((96,80,120,52),fill=ORANGE,width=9)
    d.text((140,43),"KARETA.KZ",font=BRAND,fill=fg)
    t=f"POST {n:02d}"; bb=d.textbbox((0,0),t,font=SMALL)
    d.text((W-64-(bb[2]-bb[0]),50),t,font=SMALL,fill=(190,190,190) if dark else GRAY)

def car(d,x,y,s=1.0):
    p=[(x,y+160*s),(x+75*s,y+110*s),(x+215*s,y+85*s),(x+335*s,y+85*s),(x+430*s,y+115*s),(x+510*s,y+130*s),(x+555*s,y+170*s),(x+530*s,y+205*s),(x+30*s,y+205*s)]
    d.polygon(p,fill=(50,50,50)); d.polygon([(x+125*s,y+110*s),(x+225*s,y+92*s),(x+320*s,y+92*s),(x+397*s,y+116*s)],fill=(205,210,214))
    d.ellipse((x+80*s,y+170*s,x+165*s,y+255*s),fill=(20,20,20),outline=(150,150,150),width=max(1,int(6*s)))
    d.ellipse((x+405*s,y+170*s,x+490*s,y+255*s),fill=(20,20,20),outline=(150,150,150),width=max(1,int(6*s)))
    d.rectangle((x+500*s,y+150*s,x+548*s,y+163*s),fill=ORANGE)
def phone(d,x,y,w=310,h=600,title="KARETA.KZ",rows=None):
    rows=rows or ["Услуга","Время","Подтверждение"]; rr(d,(x,y,x+w,y+h),45,WHITE,(205,205,205),3)
    d.rectangle((x+w*.36,y+15,x+w*.64,y+23),fill=(45,45,45)); d.text((x+28,y+55),title,font=F(24,True),fill=BLACK); yy=y+125
    for r in rows[:4]:
        rr(d,(x+24,yy,x+w-24,yy+92),22,BG,LIGHT,2); rr(d,(x+43,yy+27,x+83,yy+67),13,ORANGE)
        d.text((x+100,yy+28),r,font=F(23,True),fill=BLACK); yy+=112
    rr(d,(x+24,y+h-94,x+w-24,y+h-36),18,ORANGE)
def wrench(d,x,y,s=1.0):
    d.line((x,y,x+250*s,y-250*s),fill=(55,55,55),width=max(12,int(46*s)))
    d.ellipse((x-35*s,y-35*s,x+35*s,y+35*s),outline=(55,55,55),width=max(6,int(18*s)))
    d.polygon([(x+225*s,y-285*s),(x+275*s,y-320*s),(x+300*s,y-275*s),(x+265*s,y-225*s)],fill=(55,55,55))
def brake(d,x,y,r=160):
    d.ellipse((x-r,y-r,x+r,y+r),fill=(205,205,205),outline=(95,95,95),width=10)
    d.ellipse((x-r*.55,y-r*.55,x+r*.55,y+r*.55),fill=BG,outline=(95,95,95),width=8)
    for a in range(0,360,45):
        cx=x+int(math.cos(math.radians(a))*r*.78); cy=y+int(math.sin(math.radians(a))*r*.78)
        d.ellipse((cx-12,cy-12,cx+12,cy+12),fill=(120,120,120))
    rr(d,(x+r*.45,y-r*.6,x+r*.9,y+r*.3),25,ORANGE)
def oil(d,x,y,s=1.0):
    d.polygon([(x,y),(x+160*s,y),(x+205*s,y+70*s),(x+160*s,y+140*s),(x,y+140*s)],fill=ORANGE)
    d.rectangle((x+35*s,y-45*s,x+130*s,y+15*s),fill=ORANGE); d.line((x+190*s,y+30*s,x+280*s,y-30*s),fill=ORANGE,width=max(8,int(22*s)))
def mapbox(d,x,y,w=620,h=460):
    rr(d,(x,y,x+w,y+h),40,WHITE,LIGHT,3)
    for off in [90,210,340]: d.line((x+20,y+off,x+w-20,y+off+40),fill=(220,220,220),width=10)
    for off in [130,330,500]: d.line((x+off,y+25,x+off-70,y+h-25),fill=(225,225,225),width=9)
    for px,py in [(160,130),(360,210),(480,100)]:
        cx,cy=x+px,y+py; d.ellipse((cx-25,cy-25,cx+25,cy+25),fill=ORANGE); d.polygon([(cx-18,cy+12),(cx+18,cy+12),(cx,cy+55)],fill=ORANGE); d.ellipse((cx-8,cy-8,cx+8,cy+8),fill=WHITE)
def tow(d,x,y,s=1.0):
    d.rectangle((x,y+110*s,x+440*s,y+210*s),fill=ORANGE); d.polygon([(x+70*s,y+30*s),(x+260*s,y+30*s),(x+330*s,y+110*s),(x+70*s,y+110*s)],fill=(245,245,245))
    d.rectangle((x+440*s,y+145*s,x+650*s,y+185*s),fill=ORANGE); d.line((x+520*s,y+160*s,x+700*s,y+80*s),fill=(70,70,70),width=max(6,int(15*s)))
    d.ellipse((x+80*s,y+170*s,x+160*s,y+250*s),fill=(25,25,25)); d.ellipse((x+330*s,y+170*s,x+410*s,y+250*s),fill=(25,25,25))
def parts(d,x,y):
    brake(d,x+170,y+170,130); d.rectangle((x+330,y+40,x+470,y+330),fill=(40,40,40)); d.rectangle((x+340,y+60,x+460,y+310),fill=ORANGE)
    for i in range(4):
        yy=y+80+i*58; d.line((x+560,yy,x+770,yy),fill=(90,90,90),width=18); d.ellipse((x+540,yy-18,x+590,yy+32),outline=(90,90,90),width=8)
def electric(d,x,y):
    rr(d,(x,y,x+300,y+420),35,DARK); rr(d,(x+32,y+40,x+268,y+210),18,(235,235,235))
    d.line((x+145,y+265,x+90,y+340),fill=ORANGE,width=28); d.line((x+90,y+340,x+185,y+340),fill=ORANGE,width=28); d.line((x+185,y+340,x+130,y+410),fill=ORANGE,width=28)
def calendar(d,x,y):
    rr(d,(x,y,x+520,y+520),40,WHITE,LIGHT,3); d.rectangle((x,y,x+520,y+105),fill=ORANGE); d.text((x+35,y+25),"ЗАПИСЬ",font=F(34,True),fill=WHITE)
    for i,l in enumerate(["09:00","10:00","11:00","12:00"]):
        bx=x+40+(i%2)*220; by=y+155+(i//2)*120; rr(d,(bx,by,bx+180,by+82),22,ORANGE if i==1 else BG,LIGHT,2); d.text((bx+32,by+24),l,font=F(25,True),fill=WHITE if i==1 else BLACK)
def history(d,x,y):
    rr(d,(x,y,x+500,y+580),40,WHITE,LIGHT,3); d.text((x+35,y+35),"История",font=F(36,True),fill=BLACK); yy=y+120
    for i,t in enumerate(["Замена масла","Тормозные колодки","Диагностика"]):
        d.line((x+70,yy,x+70,yy+125),fill=LIGHT,width=6); d.ellipse((x+53,yy-5,x+87,yy+29),fill=ORANGE)
        d.text((x+115,yy-8),t,font=F(25,True),fill=BLACK); d.text((x+115,yy+36),f"{12-i*3} окт 2026",font=F(22),fill=GRAY); yy+=145

def hero(d,p):
    icon=p[9]
    if icon=="diagnostics": phone(d,650,570,320,610,"Диагностика",["Автомобиль","Услуга","Время"]); car(d,110,790,.9)
    elif icon=="master": phone(d,650,525,320,640,"Мастера рядом",["AutoPro","Master Garage","Koleso Service"]); wrench(d,160,1080,1.25)
    elif icon=="car": car(d,105,760,1.45); phone(d,710,520,260,610,"Мой автомобиль",["Сервис","История","Напоминания"])
    elif icon=="calendar": calendar(d,520,610); car(d,90,880,.75)
    elif icon=="brake": brake(d,730,820,230); wrench(d,200,1050,.95)
    elif icon=="parts": parts(d,170,690)
    elif icon=="electric": electric(d,610,670); car(d,90,900,.75)
    elif icon=="oil": oil(d,650,720,1.1); car(d,100,930,.8)
    elif icon=="history": history(d,520,590); car(d,85,970,.7)
    elif icon=="tow": tow(d,160,750,1.05); car(d,570,800,.65)
    elif icon=="map": mapbox(d,390,600,610,480); car(d,90,940,.72)
    else: car(d,70,820,1.25); phone(d,730,570,250,540,"KARETA.KZ",["Сервис","Мастера","Запчасти"])

def cover(p,n):
    im=Image.new("RGB",(W,H),BG); d=ImageDraw.Draw(im); brand(d,n)
    y=block(d,p[2],64,150,TITLE,BLACK,930,8,3)+15; block(d,p[3],64,y,SUB,GRAY,930,8,3); hero(d,p)
    rr(d,(64,1180,560,1270),24,ORANGE); d.text((98,1202),p[4],font=CTA,fill=WHITE); return im
def visual(p,n):
    im=Image.new("RGB",(W,H),WHITE); d=ImageDraw.Draw(im); brand(d,n)
    rr(d,(64,145,1016,1085),42,BG,LIGHT,2); d.text((105,205),"KARETA.KZ",font=F(34,True),fill=BLACK)
    block(d,p[2],105,280,F(62,True),BLACK,800,8,4)
    if p[9] in ("parts","brake"): parts(d,170,670)
    elif p[9]=="map": mapbox(d,330,610,630,460)
    elif p[9]=="tow": tow(d,200,720,.95)
    elif p[9]=="oil": oil(d,590,700,1.0); car(d,100,900,.8)
    else: phone(d,665,510,300,560,"KARETA.KZ",p[5]); car(d,110,850,.85)
    d.text((64,1145),"ВИЗУАЛЬНАЯ СИСТЕМА KARETA.KZ",font=SMALL,fill=ORANGE)
    block(d,p[3],64,1192,F(40,True),BLACK,920,6,3); return im
def bullets(p,n):
    im=Image.new("RGB",(W,H),BG); d=ImageDraw.Draw(im); brand(d,n); d.text((64,170),"ЧТО ВНУТРИ",font=SMALL,fill=ORANGE)
    y=block(d,p[2],64,215,F(66,True),BLACK,930,7,3)+28
    for i,b in enumerate(p[5],1):
        rr(d,(64,y,1016,y+165),34,WHITE,LIGHT,2); rr(d,(94,y+46,164,y+116),22,ORANGE); d.text((116,y+55),str(i),font=F(42,True),fill=WHITE)
        block(d,b,205,y+48,F(38,True),BLACK,740,5,2); y+=195
    d.text((64,1260),"Все ключевые действия — в одном сценарии.",font=SMALL,fill=GRAY); return im
def steps(p,n):
    im=Image.new("RGB",(W,H),WHITE); d=ImageDraw.Draw(im); brand(d,n); d.text((64,170),"КАК ЭТО РАБОТАЕТ",font=SMALL,fill=ORANGE); d.text((64,220),"3 шага",font=F(108,True),fill=BLACK); y=430
    for i,s in enumerate(p[6],1):
        if i<3: d.line((101,y+78,101,y+225),fill=LIGHT,width=5)
        rr(d,(64,y,140,y+76),24,ORANGE); d.text((89,y+12),str(i),font=F(42,True),fill=WHITE); block(d,s,185,y+8,F(46,True),BLACK,770,6,2); y+=245
    d.text((64,1215),p[4]+" →",font=F(50,True),fill=ORANGE); d.text((64,1288),"kareta.kz",font=SMALL,fill=GRAY); return im
def statement(p,n):
    im=Image.new("RGB",(W,H),BG); d=ImageDraw.Draw(im); brand(d,n); rr(d,(64,170,1016,355),42,ORANGE)
    d.text((105,215),"KARETA.KZ",font=F(58,True),fill=WHITE); d.text((105,292),"автомобильные задачи в одном интерфейсе",font=F(25),fill=WHITE)
    y=block(d,p[3],64,465,F(65,True),BLACK,930,10,5)+45; block(d,p[7],64,y,F(34),GRAY,930,10,7); d.text((64,1250),p[8],font=F(25),fill=GRAY); return im
def cta(p,n):
    im=Image.new("RGB",(W,H),BLACK); d=ImageDraw.Draw(im); brand(d,n,True); d.text((64,240),"ГОТОВО.",font=F(108,True),fill=ORANGE)
    y=block(d,p[2],64,390,F(72,True),WHITE,930,8,4)+35; block(d,"Откройте KARETA.KZ и перейдите к нужному действию.",64,y,F(36),(205,205,205),890,10,4)
    rr(d,(64,1030,820,1155),34,ORANGE); d.text((108,1066),p[4]+" →",font=F(42,True),fill=WHITE); d.text((64,1260),"kareta.kz",font=F(34,True),fill=WHITE); return im

GEN=[cover,visual,bullets,steps,statement,cta]
def description(folder,p,n):
    labels=["Обложка поста","Визуальный акцент / detail","Ключевые преимущества","Как это работает — 3 шага","Смысловой текстовый слайд","Финальный CTA"][:p[1]]
    lines=[f"# POST {n:02d} — {p[2]}","",f"Цель: {p[3]}","",f"Основной CTA: {p[4]}","","## Текст публикации","",p[7],"",p[8],"","## Карусель",""]
    lines += [f"{i}. {i:02d}.png — {x}." for i,x in enumerate(labels,1)]
    lines += ["","## Визуальный стиль","","Светлый фон, чёрная крупная типографика, фирменный оранжевый акцент KARETA.KZ, чистая сетка, крупные карточки, минимум визуального шума.","",f"Количество изображений: {p[1]}."]
    (folder/"description.md").write_text("\n".join(lines)+"\n",encoding="utf-8")
    payload={
        "post":n,
        "slug":p[0],
        "title":p[2],
        "goal":p[3],
        "cta":p[4],
        "caption":p[7],
        "hashtags":p[8].split(),
        "format":"instagram_carousel_4x5",
        "size":"1080x1350",
        "image_count":p[1],
        "images":[f"{i:02d}.png" for i in range(1,p[1]+1)],
        "cover":"01.png",
        "status":"draft"
    }
    (folder/"post.json").write_text(json.dumps(payload,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")

def build_grid_preview(manifest):
    tile_w,tile_h=360,450
    grid=Image.new("RGB",(tile_w*4,tile_h*3),WHITE)
    for idx,m in enumerate(manifest):
        src=Image.open(OUT/m["slug"]/"01.png").convert("RGB")
        src=src.resize((tile_w,tile_h),Image.Resampling.LANCZOS)
        x=(idx%4)*tile_w; y=(idx//4)*tile_h
        grid.paste(src,(x,y))
    grid.save(OUT/"grid-preview.jpg","JPEG",quality=92,optimize=True,progressive=True,subsampling=1)

def write_publishing_plan(manifest):
    phases=[
        ("Знакомство с продуктом",[1,2,3,4]),
        ("Решение конкретных задач",[5,6,7,8]),
        ("Удержание и экосистема",[9,10,11,12]),
    ]
    lines=["# KARETA.KZ — порядок публикации 12 Instagram-постов","",
           "Последовательность построена как единая лента: сначала объясняем ценность сервиса, затем показываем прикладные сценарии, после — функции удержания и экосистему.",""]
    by_num={m["post"]:m for m in manifest}
    for phase,nums in phases:
        lines += [f"## {phase}",""]
        for num in nums:
            m=by_num[num]
            p=POSTS[num-1]
            lines += [f"### {num:02d}. {m['title']}",
                      f"- Папка: \`{m['slug']}/\`",
                      f"- Карусель: {m['images']} изображений",
                      f"- CTA: {p[4]}",
                      f"- Смысл: {p[3]}",
                      ""]
    lines += ["## Правило публикации","",
              "Первая картинка в каждой папке — обложка поста. Остальные изображения публикуются в том же порядке, в котором пронумерованы файлы.",
              "",
              "Текст подписи и хэштеги находятся в \`description.md\` каждой папки.",
              "",
              "Общее превью ленты: \`grid-preview.jpg\`."]
    (OUT/"PUBLISHING_PLAN.md").write_text("\n".join(lines)+"\n",encoding="utf-8")
    (OUT/"feed-order.json").write_text(json.dumps({
        "layout":"4x3",
        "cover_file":"01.png",
        "posts":[{"position":m["post"],"folder":m["slug"],"title":m["title"],"images":m["images"]} for m in manifest]
    },ensure_ascii=False,indent=2)+"\n",encoding="utf-8")

def write_master_captions(manifest):
    lines=["# KARETA.KZ — MASTER CAPTIONS","","Готовые подписи для 12 Instagram-постов. Порядок соответствует feed-order.json.",""]
    for m in manifest:
        p=POSTS[m["post"]-1]
        lines += [f"## {m['post']:02d}. {m['title']}","",p[7],"",p[8],"",f"CTA: {p[4]}",""]
    (OUT/"MASTER_CAPTIONS.md").write_text("\n".join(lines)+"\n",encoding="utf-8")

def main():
    OUT.mkdir(parents=True,exist_ok=True); manifest=[]; total=0
    for n,p in enumerate(POSTS,1):
        folder=OUT/p[0]; folder.mkdir(parents=True,exist_ok=True)
        for old in folder.glob("*.png"): old.unlink()
        for i in range(p[1]): GEN[i](p,n).save(folder/f"{i+1:02d}.png","PNG",optimize=True,compress_level=9)
        description(folder,p,n); total+=p[1]; manifest.append({"post":n,"slug":p[0],"title":p[2],"images":p[1]})
    (OUT/"manifest.json").write_text(json.dumps({"posts":manifest,"total_images":total,"size":"1080x1350"},ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    build_grid_preview(manifest)
    write_publishing_plan(manifest)
    write_master_captions(manifest)
    lines=["# KARETA.KZ — Instagram / 12 posts","","12 отдельных постов. В каждой папке есть description.md, post.json и 3–6 изображений карусели.","","Все изображения: 1080×1350 (4:5).","Общее превью ленты: grid-preview.jpg.","Порядок публикации: PUBLISHING_PLAN.md.","Готовые тексты: MASTER_CAPTIONS.md.","","## Состав",""]
    for m in manifest: lines.append(f"{m['post']}. {m['slug']}/ — {m['title']} — {m['images']} изображений.")
    lines += ["",f"Всего изображений: {total}.","","Генератор: tools/social/generate_instagram_assets.py."]
    (OUT/"README.md").write_text("\n".join(lines)+"\n",encoding="utf-8")
    print(f"Generated {len(POSTS)} posts / {total} images + grid preview + publishing plan")
if __name__=="__main__": main()
