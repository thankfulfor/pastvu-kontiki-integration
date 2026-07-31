# Данные

В этой папке лежат небольшие тестовые выборки для прототипа. Они нужны, чтобы быстро проверять карту и структуру полей без загрузки полного GeoPackage.

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

## Fixture

Файл:

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
