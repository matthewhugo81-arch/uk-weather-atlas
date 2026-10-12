"""Generate a small, offline regional lookup from ONS December 2024 boundaries.
Run: python scripts/build-regional-boundaries.py /path/to/ons-inputs
Requires shapely >= 2. Kept separate from the ordinary Pages build; no runtime API.
"""
import json, sys
from pathlib import Path
from shapely.geometry import shape, mapping, Polygon, Point
from shapely.ops import unary_union
from shapely import make_valid
root=Path(__file__).resolve().parents[1]
source=Path(sys.argv[1])
groups={}
for filename,field in [('regions','RGN24NM'),('countries','CTRY24NM')]:
    for f in json.loads((source/(filename+'.json')).read_text())['features']:
        name=f['properties'][field]
        if name=='England': continue
        region=({'North East':'north','North West':'north','Yorkshire and The Humber':'north',
                 'East Midlands':'midlands','West Midlands':'midlands','East of England':'south',
                 'London':'south','South East':'south','South West':'south',
                 'Scotland':'scotland','Wales':'wales','Northern Ireland':'ni'})[name]
        groups.setdefault(region,[]).append(make_valid(shape(f['geometry'])))

def rounded(x):
    if isinstance(x,(tuple,list)): return [rounded(v) for v in x]
    if isinstance(x,float): return round(x,4)
    return x
def polygon_parts(g):
    if g.geom_type=='Polygon': yield g
    elif hasattr(g,'geoms'):
        for child in g.geoms: yield from polygon_parts(child)

directory=json.loads((root/'src/stations.json').read_text())
station_points=[Point(s['lon'],s['lat']) for s in directory if s.get('inScope')]
features=[]
for key,shapes in groups.items():
    g=unary_union(shapes)
    # Simplification is only for station grouping, never for map or forecast geometry.
    g=g.simplify(.003,preserve_topology=True)
    polygons=list(polygon_parts(g))
    # Small islands are retained; each gets an envelope for efficient point lookup.
    for p in polygons:
        if p.area < .00008 and not any(p.distance(point)<.007 for point in station_points): continue
        p=Polygon(p.exterior,[ring for ring in p.interiors if Polygon(ring).area>=.00008])
        features.append({'region':key,'bounds':rounded(p.bounds),'rings':rounded(mapping(p)['coordinates'])})
data={'version':1,'source':'ONS December 2024 UK Countries and England Regions, BGC',
      'attribution':'Contains OS data © Crown copyright and database right 2024. Contains National Statistics data © Crown copyright and database right 2024. Open Government Licence v3.0.',
      'toleranceKm':2,'features':features}
text=json.dumps(data,separators=(',',':'),ensure_ascii=False)+'\n'
for target in ['dist','docs']:
    (root/target/'regional-boundaries.json').write_text(text)
print('Regional boundaries:',len(features),'polygons,',len(text.encode()),'bytes')
