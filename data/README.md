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

### Рабочая выборка для первой версии

Файл:

```text
data/fixtures/old-moscow-1917-1953.geojson
```

Содержимое:

- 16 867 объектов из слоя `all_cities_181123`;
- фильтр: `city = 'old moscow'`;
- годы: `1917—1953`;
- только объекты с непустым адресом;
- формат: GeoJSON;
- система координат: `EPSG:4326`;
- геометрия: `MultiPolygon`;
- размер: около 15 МБ.

Команда экспорта:

```bash
ogr2ogr -f GeoJSON data/fixtures/old-moscow-1917-1953.geojson /Users/zhanna/Downloads/HOITH_database_231118.gpkg all_cities_181123 -where "city = 'old moscow' AND r_year_int >= 1917 AND r_year_int <= 1953 AND r_adress IS NOT NULL AND r_adress <> ''" -select r_year_int,r_name,r_adress,r_floors,city,city_russian,city_english,r_years_str -t_srs EPSG:4326 -dim XY
```
