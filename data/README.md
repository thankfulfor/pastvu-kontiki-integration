# Данные

В этой папке лежат подготовленные выборки для прототипа. Они нужны, чтобы проверять карту и структуру полей без загрузки полного GeoPackage.

## Источник

Исходный набор данных:

```text
https://kontikimaps.ru/how-old/cities250/datasets?p=cities250
```

Файл, использованный для подготовки fixture:

```text
HOITH_database_231118.gpkg
```

## Лицензия данных

Данные Kontiki Maps опубликованы под Open Data Commons Open Database License (ODbL). Если в проекте используются или публикуются производные данные, нужно указывать источник и соблюдать требования ODbL, включая share-alike для производных баз данных.

Лицензия данных не равна лицензии кода проекта. Код и производные данные нужно описывать отдельно.

## Fixtures

### Тестовая выборка

```text
data/fixtures/old-moscow-sample.geojson
```

Содержимое:

- 100 объектов из слоя `all_cities_181123`;
- фильтр: `city = 'old moscow'`;
- формат: GeoJSON;
- система координат: `EPSG:4326`;
- геометрия: `MultiPolygon`.

Команда экспорта:

```bash
ogr2ogr -f GeoJSON data/fixtures/old-moscow-sample.geojson /Users/zhanna/Downloads/HOITH_database_231118.gpkg all_cities_181123 -where "city = 'old moscow'" -limit 100 -t_srs EPSG:4326 -dim XY
```

### Рабочие выборки по периодам

Файлы:

```text
data/fixtures/old-moscow-periods/
```

Содержимое:

- 110 598 объектов из слоя `all_cities_181123`;
- фильтр: `city = 'old moscow'`;
- годы: `1357—2021`;
- только объекты с непустым адресом;
- формат: GeoJSON;
- система координат: `EPSG:4326`;
- геометрия: `MultiPolygon`;
- данные разбиты на файлы по периодам цветной шкалы.

Количество объектов по периодам:

| Период | Объектов |
| --- | ---: |
| 1357—1688 | 109 |
| 1689—1916 | 6 148 |
| 1917—1923 | 3 922 |
| 1924—1952 | 11 976 |
| 1953—1963 | 19 963 |
| 1964—1981 | 32 823 |
| 1982—1990 | 11 648 |
| 1991—2009 | 21 074 |
| 2010—2021 | 2 935 |

Пример команды экспорта для одного периода:

```bash
ogr2ogr -f GeoJSON data/fixtures/old-moscow-periods/old-moscow-1924-1952.geojson /Users/zhanna/Downloads/HOITH_database_231118.gpkg all_cities_181123 -where "city = 'old moscow' AND r_year_int >= 1924 AND r_year_int <= 1952 AND r_adress IS NOT NULL AND r_adress <> ''" -select r_year_int,r_name,r_adress,r_floors,city,city_russian,city_english,r_years_str,isApartmentBuilding,livingQuarters,r_architect,r_photo_url,r_wikipedia -t_srs EPSG:4326 -dim XY
```

В интерфейсе также показываются, если они заполнены: архитектор, признак многоквартирного дома, количество жилых помещений, внешняя ссылка из Kontiki и статья в Википедии. Поле `r_wikidata` в этой выборке не заполнено.

### Поисковый индекс

Файл `data/search-index.json` создаётся из рабочих GeoJSON-файлов командой:

```bash
node scripts/build-search-index.mjs
```

В нём нет контуров зданий. Для каждого объекта сохранены идентификатор, период, название, адрес, год и примерный центр контура. Индекс нужен, чтобы искать по всей выборке, не загружая все GeoJSON-файлы при открытии страницы.
