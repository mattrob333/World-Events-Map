# Seed rows for activities.json. Coordinates, summit elevations and heat are
# NOT typed here: build.py resolves them from Wikipedia (coordinates, infobox
# top elevation) and Wikimedia pageviews (heat). Months come from the brief's
# country list. Event dates come from the official or reporting URLs listed.

F1_26 = "https://www.formula1.com/en/racing/2026"
F1_27 = "https://www.astonmartinf1.com/en-GB/news/announcement/f1-2027-calendar-revealed"

COUNTRIES = {
 # cc: (name, region)
 "NO":("Norway","Nordic and Arctic"),"FI":("Finland","Nordic and Arctic"),"SE":("Sweden","Nordic and Arctic"),
 "IS":("Iceland","Nordic and Arctic"),"DK":("Denmark","Nordic and Arctic"),"GL":("Greenland","Nordic and Arctic"),
 "GB":("United Kingdom","Western and Central Europe"),"IE":("Ireland","Western and Central Europe"),"FR":("France","Western and Central Europe"),
 "MC":("Monaco","Western and Central Europe"),"ES":("Spain","Western and Central Europe"),"PT":("Portugal","Western and Central Europe"),
 "IT":("Italy","Western and Central Europe"),"CH":("Switzerland","Western and Central Europe"),"AT":("Austria","Western and Central Europe"),
 "DE":("Germany","Western and Central Europe"),"NL":("Netherlands","Western and Central Europe"),"BE":("Belgium","Western and Central Europe"),
 "HU":("Hungary","Western and Central Europe"),"CZ":("Czech Republic","Western and Central Europe"),"SI":("Slovenia","Western and Central Europe"),
 "HR":("Croatia","Western and Central Europe"),"GR":("Greece","Western and Central Europe"),"TR":("Turkey","Western and Central Europe"),
 "AE":("United Arab Emirates","Middle East and North Africa"),"SA":("Saudi Arabia","Middle East and North Africa"),"QA":("Qatar","Middle East and North Africa"),
 "BH":("Bahrain","Middle East and North Africa"),"OM":("Oman","Middle East and North Africa"),"JO":("Jordan","Middle East and North Africa"),
 "EG":("Egypt","Middle East and North Africa"),"MA":("Morocco","Middle East and North Africa"),
 "KE":("Kenya","Sub-Saharan Africa and Indian Ocean"),"TZ":("Tanzania","Sub-Saharan Africa and Indian Ocean"),"RW":("Rwanda","Sub-Saharan Africa and Indian Ocean"),
 "UG":("Uganda","Sub-Saharan Africa and Indian Ocean"),"ZA":("South Africa","Sub-Saharan Africa and Indian Ocean"),"BW":("Botswana","Sub-Saharan Africa and Indian Ocean"),
 "NA":("Namibia","Sub-Saharan Africa and Indian Ocean"),"ZM":("Zambia","Sub-Saharan Africa and Indian Ocean"),"ZW":("Zimbabwe","Sub-Saharan Africa and Indian Ocean"),
 "MG":("Madagascar","Sub-Saharan Africa and Indian Ocean"),"MU":("Mauritius","Sub-Saharan Africa and Indian Ocean"),"SC":("Seychelles","Sub-Saharan Africa and Indian Ocean"),
 "JP":("Japan","Asia"),"KR":("South Korea","Asia"),"CN":("China","Asia"),"HK":("Hong Kong","Asia"),"TW":("Taiwan","Asia"),"TH":("Thailand","Asia"),
 "VN":("Vietnam","Asia"),"KH":("Cambodia","Asia"),"ID":("Indonesia","Asia"),"PH":("Philippines","Asia"),"MY":("Malaysia","Asia"),"SG":("Singapore","Asia"),
 "MV":("Maldives","Asia"),"LK":("Sri Lanka","Asia"),"IN":("India","Asia"),"NP":("Nepal","Asia"),"BT":("Bhutan","Asia"),"MN":("Mongolia","Asia"),"UZ":("Uzbekistan","Asia"),
 "AU":("Australia","Oceania"),"NZ":("New Zealand","Oceania"),"FJ":("Fiji","Oceania"),"PF":("French Polynesia","Oceania"),"AQ":("Antarctica","Oceania"),
 "US":("United States","North America"),"CA":("Canada","North America"),"MX":("Mexico","North America"),
 "CR":("Costa Rica","Caribbean and Central America"),"BZ":("Belize","Caribbean and Central America"),"GT":("Guatemala","Caribbean and Central America"),
 "BS":("Bahamas","Caribbean and Central America"),"DO":("Dominican Republic","Caribbean and Central America"),"TT":("Trinidad and Tobago","Caribbean and Central America"),
 "BB":("Barbados","Caribbean and Central America"),
 "BR":("Brazil","South America"),"AR":("Argentina","South America"),"CL":("Chile","South America"),"PE":("Peru","South America"),
 "EC":("Ecuador","South America"),"CO":("Colombia","South America"),"BO":("Bolivia","South America"),"UY":("Uruguay","South America"),
}

def E(start, end, status, url):
    return {"start": start, "end": end, "status": status, "sourceUrl": url}

# (cc, name, place, category, kind, best, peak, wikiTitle, summary, tags, eventDates, conditionsOverride)
ROWS = [
# ---------------- Norway
("NO","Northern lights in Tromsø","Tromsø","nature","place","9-3","12-2","Tromsø","Aurora zone city at 69°N with dark polar nights and fjord-side viewing spots",["solo","family"],None,"aurora"),
("NO","Lofoten aurora and peaks","Lofoten","nature","place","9-3","10-11","Lofoten","Jagged island peaks and fishing villages under autumn and winter auroras",["solo","adrenaline"],None,"aurora"),
("NO","Preikestolen hike","Lysefjord","nature","place","6-9","7-8","Preikestolen","Four-hour round trip to a flat cliff 604 m above the Lysefjord",["family","adrenaline"],None,None),
("NO","Trolltunga hike","Odda","nature","place","6-9","7-8","Trolltunga","Long day hike to a rock ledge jutting 700 m over Lake Ringedalsvatnet",["adrenaline","solo"],None,None),
("NO","Geirangerfjord cruise","Geiranger","nature","place","6-9","7-8","Geirangerfjord","UNESCO fjord with the Seven Sisters falls, best seen from the ferry",["family","luxury"],None,None),
("NO","Midnight sun at North Cape","Nordkapp","nature","place","5-7","6-7","North Cape","Sun stays above the horizon at Europe's northern cliff from mid-May to late July",["solo","family"],None,None),
("NO","Hemsedal skiing","Hemsedal","ski","place","12-4","2-3","Hemsedal Skisenter","Norway's steepest lift-served terrain, a short drive from Oslo",["family","adrenaline"],None,None),
("NO","Trysil skiing","Trysil","ski","place","12-4","2-3","Trysil","Norway's largest ski resort with 60+ slopes on one mountain",["family","budget"],None,None),
# ---------------- Finland
("FI","Lapland northern lights","Rovaniemi","nature","place","12-3","12-2","Rovaniemi","Glass-roof cabins and forest tours on the Arctic Circle",["family","luxury"],None,"aurora"),
("FI","Santa Claus Village","Rovaniemi","culture","place","12-3","12","Santa Claus Village","Santa's office, reindeer rides and the Arctic Circle line in one park",["family"],None,None),
("FI","Husky sledding in Levi","Kittilä","nature","place","12-3","1-3","Levi, Finland","Drive your own husky team through snowy fell forest",["family","adrenaline"],None,None),
("FI","Levi skiing","Kittilä","ski","place","11-5","2-4","Levi, Finland","Finland's biggest ski area, with lifts running from November to May",["family"],None,None),
("FI","Ruka skiing","Kuusamo","ski","place","11-5","2-4","Ruka","Long-season fell resort known for early snow and the Ruka Nordic event",["family"],None,None),
("FI","Helsinki sauna culture","Helsinki","wellness","place","all","12-3","Löyly","Public saunas by the sea, with a cold dip in the Baltic between rounds",["solo","budget"],None,None),
("FI","Flow Festival","Helsinki","festival","event","8","8","Suvilahti","Music, art and food festival in a former power plant in Suvilahti",["nightlife","solo"],E("2027-08-13","2027-08-15","confirmed","https://www.flowfestival.com/en/info/info-faq/"),None),
# ---------------- Sweden
("SE","Icehotel","Jukkasjärvi","culture","place","12-4","1-3","Icehotel (Jukkasjärvi)","Hotel rebuilt from Torne River ice each winter, with art suites at -5 °C",["luxury"],None,None),
("SE","Abisko aurora","Abisko","nature","place","9-3","12-2","Abisko National Park","Aurora Sky Station on a mountain in one of the clearest skies in Lapland",["solo"],None,"aurora"),
("SE","Midsummer at Skansen","Stockholm","festival","event","6","6","Skansen","Maypole dancing, flower crowns and herring in Stockholm's open-air museum",["family"],E("2027-06-25","2027-06-25","confirmed","https://visitsweden.com/what-to-do/culture-history-and-art/swedish-traditions/midsummer-tradition/midsummer-sweden-something-another-world/"),None),
("SE","Stockholm archipelago kayaking","Stockholm archipelago","nature","place","6-8","7","Stockholm archipelago","Paddle between some 30,000 islands with wild camping allowed",["solo","adrenaline"],None,None),
("SE","Åre skiing","Åre","ski","place","12-4","2-4","Åre","Scandinavia's largest ski area, host of the 2019 World Championships",["nightlife","family"],None,None),
# ---------------- Iceland
("IS","Northern lights at Þingvellir","Þingvellir","nature","place","11-3","12-2","Þingvellir","Dark rift valley an hour from Reykjavík, a classic aurora stop",["solo","family"],None,"aurora"),
("IS","Vatnajökull ice caves","Vatnajökull","nature","place","11-3","1-2","Vatnajökull","Guided tours into blue glacier caves that form only in winter",["adrenaline"],None,None),
("IS","Ring Road drive","Iceland","nature","place","6-8","7","Route 1 (Iceland)","1,332 km loop past waterfalls, black beaches and glacier lagoons",["solo","family"],None,None),
("IS","Whale watching in Húsavík","Húsavík","nature","place","6-8","6-7","Húsavík","Humpbacks and minke whales in Skjálfandi Bay on most summer trips",["family"],None,None),
("IS","Puffins at Látrabjarg","Látrabjarg","nature","place","6-8","6-7","Látrabjarg","Europe's largest bird cliff, where puffins nest a few meters away",["family","solo"],None,None),
("IS","Blue Lagoon","Grindavík","wellness","place","all","12-2","Blue Lagoon (geothermal spa)","Milky geothermal spa in a lava field near Keflavík airport",["luxury"],None,None),
("IS","Iceland Airwaves","Reykjavík","concert","event","11","11","Reykjavík","Multi-venue music festival across Reykjavík's downtown clubs",["nightlife","solo"],E("2026-11-05","2026-11-07","confirmed","https://icelandairwaves.is/lineup/"),None),
# ---------------- Denmark
("DK","Copenhagen fine dining","Copenhagen","food","place","5-9","6-8","Noma (restaurant)","New Nordic tasting menus and a dense cluster of Michelin restaurants",["luxury"],None,None),
("DK","Copenhagen by bike","Copenhagen","city","place","5-9","6-8","Copenhagen","Flat city with protected bike lanes and harbor swim spots",["family","budget"],None,None),
("DK","Roskilde Festival","Roskilde","festival","event","6-7","6-7","Roskilde Festival","Non-profit music festival with 130,000 people and 180+ acts",["nightlife","budget"],E("2027-06-26","2027-07-03","confirmed","https://www.roskilde-festival.dk/en/news/thank-you-roskilde-see-you-in-2027"),None),
("DK","Christmas in Tivoli","Copenhagen","culture","event","11-12","12","Tivoli Gardens","The 1843 amusement park dressed in lights, stalls and a Christmas market",["family"],E("2026-11-13","2027-01-03","confirmed","https://www.visitcopenhagen.com/copenhagen/planning/christmas-in-tivoli-gardens-gdk1096403"),None),
# ---------------- Greenland
("GL","Ilulissat Icefjord","Ilulissat","nature","place","6-8","7","Ilulissat Icefjord","UNESCO fjord where the Sermeq Kujalleq glacier calves huge icebergs",["adrenaline","solo"],None,None),
("GL","Disko Bay kayaking","Ilulissat","nature","place","6-8","7","Disko Bay","Sea kayaking between drifting icebergs under the midnight sun",["adrenaline"],None,"marine"),
("GL","Kangerlussuaq aurora","Kangerlussuaq","nature","place","9-3","10-2","Kangerlussuaq","Inland airport town with over 300 clear nights a year for aurora",["solo"],None,"aurora"),
# ---------------- United Kingdom
("GB","Wimbledon","London","sports","event","6-7","7","All England Lawn Tennis and Croquet Club","The grass-court Grand Slam, celebrating 150 years in 2027",["luxury"],E("2027-06-28","2027-07-11","confirmed","https://www.wimbledon.com/en_GB/the_championships/dates"),None),
("GB","British Grand Prix","Silverstone","sports","event","7","7","Silverstone Circuit","F1 at Silverstone, a sprint weekend in 2027",["adrenaline"],E("2027-07-02","2027-07-04","confirmed",F1_27),None),
("GB","Edinburgh Festival Fringe","Edinburgh","festival","event","8","8","Edinburgh Festival Fringe","The world's largest arts festival, 80th edition in 2027",["nightlife","budget","solo"],E("2027-08-06","2027-08-30","confirmed","https://www.edfringe.com/experience/plan-your-visit/"),None),
("GB","Scottish Highlands and whisky","Speyside","food","place","5-9","6-8","Speyside single malts","Distillery tours along the River Spey, with hill walks between tastings",["solo","luxury"],None,None),
("GB","Tour de France Grand Départ","Edinburgh","sports","event","7","7","Edinburgh","The 2027 Tour starts in Edinburgh on July 2",["family"],E("2027-07-02","2027-07-25","confirmed","https://fr.wikipedia.org/wiki/Tour_de_France_2027"),None),
# ---------------- Ireland
("IE","Links golf at Lahinch","Lahinch","sports","place","5-9","6-8","Lahinch Golf Club","Dune links on the Clare coast, often called the St Andrews of Ireland",["luxury"],None,None),
("IE","Wild Atlantic Way","Cliffs of Moher","nature","place","5-9","6-8","Cliffs of Moher","2,500 km coast route; the Cliffs of Moher rise 214 m over the ocean",["family","solo"],None,None),
("IE","St. Patrick's Festival","Dublin","festival","event","3","3","Dublin","Five days of parades, céilí and music ending on March 17",["family","nightlife"],E("2027-03-13","2027-03-17","confirmed","https://stpatricksfestival.ie/your-visit/"),None),
# ---------------- France
("FR","Chamonix skiing","Chamonix","ski","place","12-4","1-3","Aiguille du Midi","Off-piste runs under Mont Blanc, including the 20 km Vallée Blanche",["adrenaline"],None,None),
("FR","Courchevel skiing","Courchevel","ski","place","12-4","1-3","Courchevel","Part of Les 3 Vallées, 600 km of linked pistes",["luxury","family"],None,None),
("FR","Cannes Film Festival","Cannes","culture","event","5","5","Palais des Festivals et des Congrès","80th edition on the Croisette; public screenings on the beach",["luxury"],E("2027-05-11","2027-05-22","confirmed","https://en.palaisdesfestivals.com/palais-events/trade-shows-and-events/cannes-film-festival/"),None),
("FR","Tour de France finish","Paris","sports","event","7","7","Champs-Élysées","Three weeks of racing that finish on the Champs-Élysées",["family"],E("2027-07-02","2027-07-25","confirmed","https://fr.wikipedia.org/wiki/Tour_de_France_2027"),None),
("FR","Bordeaux wine harvest","Saint-Émilion","food","place","9-10","9","Saint-Émilion","Harvest season in hilltop Saint-Émilion's châteaux",["luxury"],None,None),
("FR","Champagne harvest","Épernay","food","place","9-10","9","Épernay","Cellar tours under the Avenue de Champagne during the vendange",["luxury"],None,None),
# ---------------- Monaco
("MC","Monaco Grand Prix","Monte Carlo","sports","event","6","6","Circuit de Monaco","Street race through the harbor, a sprint weekend in 2027",["luxury"],E("2027-06-04","2027-06-06","confirmed",F1_27),None),
("MC","Casino de Monte-Carlo","Monte Carlo","nightlife","place","all","5-8","Monte Carlo Casino","Belle Époque casino and square lined with supercars",["luxury","nightlife"],None,None),
("MC","Port Hercule yachts","Monaco","city","place","4-10","6-8","Port Hercule","Superyacht harbor with waterfront terraces below the palace",["luxury"],None,None),
# ---------------- Spain
("ES","San Sebastián pintxos","San Sebastián","food","place","all","6-9","San Sebastián","Pintxo bars in the old town and one of the densest Michelin scenes",["solo","luxury"],None,None),
("ES","Ibiza clubs","Sant Antoni de Portmany","nightlife","place","6-9","7-8","Ushuaïa Ibiza Beach Hotel","Superclubs like Ushuaïa and Hï run from opening to closing parties",["nightlife","luxury"],None,None),
("ES","San Fermín","Pamplona","festival","event","7","7","Pamplona","Running of the Bulls each morning from July 7 to 14",["adrenaline","nightlife"],E("2027-07-06","2027-07-14","confirmed","https://www.spain.info/es/agenda/fiestas-san-fermin/"),None),
("ES","Canary Islands surf","Fuerteventura","surf","place","11-3","12-2","Corralejo","Reef and beach breaks on Fuerteventura's north shore with winter swell",["budget","adrenaline"],None,None),
("ES","Canary Islands winter sun","Tenerife","beach","place","11-3","12-2","Los Cristianos","Reliable 20s °C in winter on Tenerife's south coast",["family","budget"],None,None),
# ---------------- Portugal
("PT","Nazaré big waves","Nazaré","surf","place","10-3","11-2","Praia do Norte","Canyon-focused swell builds some of the largest waves ever surfed",["adrenaline"],None,None),
("PT","Douro Valley harvest","Pinhão","food","place","9","9","Pinhão","Terraced port vineyards; join grape picking at quintas in September",["luxury"],None,None),
("PT","Algarve beaches and golf","Lagos","beach","place","4-10","6-9","Ponta da Piedade","Sea stacks, grottoes and golf resorts along the south coast",["family"],None,None),
("PT","Santo António festival","Lisbon","festival","event","6","6","Alfama","Street parties, grilled sardines and the Marchas parade on June 12",["nightlife","budget"],E("2027-06-12","2027-06-13","confirmed","https://events.europa.tips/lisboa?lang=en"),None),
("PT","Portuguese Grand Prix","Portimão","sports","event","6","6","Algarve International Circuit","F1 returns to the rollercoaster Portimão track in 2027",["adrenaline"],E("2027-06-18","2027-06-20","confirmed",F1_27),None),
# ---------------- Italy
("IT","Dolomites skiing","Val Gardena","ski","place","12-4","1-3","Sellaronda","Sella Ronda loop links four valleys on 40 km of pistes",["family"],None,None),
("IT","Dolomites via ferrata","Cortina d'Ampezzo","nature","place","6-9","7-8","Tofane","Iron-cable climbing routes on WWI paths above Cortina",["adrenaline"],None,None),
("IT","Venice Carnival","Venice","festival","event","1-2","2","St Mark's Square","Masks, costume balls and water parades before Lent",["luxury"],E("2027-01-23","2027-02-09","confirmed","https://carnevale.venezia.it/en/"),None),
("IT","Amalfi Coast","Positano","beach","place","5-9","6-8","Positano","Cliffside towns, lemon groves and boat days to Capri",["luxury"],None,None),
("IT","Tuscany wine and truffles","Montalcino","food","place","9-11","10-11","Montalcino","Brunello cellars and white truffle hunts in the autumn hills",["luxury"],None,None),
("IT","Italian Grand Prix","Monza","sports","event","9","9","Monza Circuit","The Temple of Speed, a sprint weekend in 2027",["adrenaline"],E("2027-09-03","2027-09-05","confirmed",F1_27),None),
# ---------------- Switzerland
("CH","Zermatt skiing","Zermatt","ski","place","12-4","1-3","Klein Matterhorn","Ski under the Matterhorn and across the border to Cervinia",["luxury","adrenaline"],None,None),
("CH","Verbier skiing","Verbier","ski","place","12-4","1-3","Mont Fort","Freeride capital of the 4 Vallées and the Xtreme Verbier contest",["adrenaline","nightlife"],None,None),
("CH","Jungfrau region hiking","Grindelwald","nature","place","6-9","7-8","Grindelwald","Trails under the Eiger north face and the Jungfraujoch railway",["family"],None,None),
("CH","Montreux Jazz Festival","Montreux","concert","event","7","7","Montreux Jazz Festival","Two weeks of concerts on the shore of Lake Geneva",["luxury"],E("2027-07-02","2027-07-17","confirmed","https://www.montreuxjazzfestival.com/en/"),None),
("CH","Art Basel","Basel","culture","event","6","6","Messe Basel","The leading modern and contemporary art fair",["luxury"],E("2027-06-17","2027-06-20","confirmed","https://www.artbasel.com/about/application"),None),
# ---------------- Austria
("AT","St. Anton skiing","St. Anton am Arlberg","ski","place","12-4","1-3","Valluga","Big Arlberg terrain and famous après-ski at MooserWirt",["nightlife","adrenaline"],None,None),
("AT","Salzburg Festival","Salzburg","concert","event","7-8","8","Salzburg Festival","Opera, drama and concerts in Mozart's city each summer",["luxury"],E("2027-07-16","2027-08-29","estimated","https://www.fluege.de/travel-insights/events/"),None),
("AT","Vienna Christmas market","Vienna","culture","event","11-12","12","Wiener Rathaus","Market and ice rink in front of City Hall",["family"],E("2026-11-13","2026-12-26","confirmed","https://www.christkindlmarkt.at/en/"),None),
("AT","Vienna ball season","Vienna","concert","place","1-2","1-2","Vienna Opera Ball","Hundreds of formal balls, led by the Opera Ball in February",["luxury"],None,None),
("AT","Austrian Grand Prix","Spielberg","sports","event","7","7","Red Bull Ring","Short, fast lap in the Styrian hills",["adrenaline"],E("2027-07-09","2027-07-11","confirmed",F1_27),None),
# ---------------- Germany
("DE","Oktoberfest","Munich","festival","event","9-10","9-10","Theresienwiese","191st edition on the Theresienwiese, with 16 days of beer tents",["nightlife","family"],E("2026-09-19","2026-10-04","confirmed","https://www.oktoberfest.de/en"),None),
("DE","Munich Christmas market","Munich","culture","event","11-12","12","Marienplatz","Christkindlmarkt on Marienplatz under the New Town Hall",["family"],E("2026-11-20","2026-12-24","confirmed","https://www.christkindlmarkt-muenchen.de/en/home"),None),
("DE","Berlin techno clubs","Berlin","nightlife","place","all","6-8","Berghain","Weekend-long club nights at Berghain and other venues",["nightlife","solo"],None,None),
("DE","Nürburgring track days","Nürburg","sports","place","4-10","6-8","Nürburgring","Drive the 20.8 km Nordschleife on public tourist days",["adrenaline"],None,None),
# ---------------- Netherlands
("NL","Keukenhof tulips","Lisse","nature","place","3-5","4","Keukenhof","Seven million bulbs in bloom; open March 18 to May 9 in 2027",["family"],None,None),
("NL","King's Day","Amsterdam","festival","event","4","4","Amsterdam","City-wide orange street party and flea market on April 27",["nightlife","budget"],E("2027-04-27","2027-04-27","confirmed","https://en.wikipedia.org/wiki/King%27s_Day"),None),
("NL","Amsterdam Dance Event","Amsterdam","nightlife","event","10","10","Amsterdam Dance Event","Five days of electronic music across 200 venues",["nightlife"],E("2026-10-21","2026-10-25","confirmed","https://www.iamsterdam.com/en/whats-on/amsterdam-dance-event-ade"),None),
# ---------------- Belgium
("BE","Tomorrowland","Boom","festival","event","7","7","Tomorrowland (festival)","Two weekends of electronic music at De Schorre",["nightlife"],E("2027-07-16","2027-07-25","estimated","https://mainstagefm.com/festivals/tomorrowland/"),None),
("BE","Belgian Grand Prix","Spa","sports","event","7","7","Circuit de Spa-Francorchamps","Eau Rouge and Raidillon in the Ardennes forest",["adrenaline"],E("2027-07-23","2027-07-25","confirmed",F1_27),None),
("BE","Belgian beer tour","Bruges","food","place","all","5-9","Bruges","Trappist and lambic tastings in canal-side Bruges",["solo","budget"],None,None),
# ---------------- Hungary
("HU","Budapest thermal baths","Budapest","wellness","place","all","11-2","Széchenyi thermal bath","Outdoor hot pools at Széchenyi, open all year",["budget","family"],None,None),
("HU","Sziget Festival","Budapest","festival","event","8","8","Sziget Festival","Island festival on the Danube, 5 days of music",["nightlife","budget"],E("2027-08-10","2027-08-14","confirmed","https://szigetfestival.com/en/festival-info"),None),
("HU","Hungarian Grand Prix","Mogyoród","sports","event","7-8","7","Hungaroring","Twisty track outside Budapest before the summer break",["adrenaline"],E("2027-07-30","2027-08-01","confirmed",F1_27),None),
# ---------------- Czech Republic
("CZ","Prague beer and old town","Prague","city","place","4-10","5-9","Old Town Square","Gothic old town, castle hill and pilsner in historic pubs",["budget","nightlife"],None,None),
("CZ","Prague Christmas markets","Prague","culture","event","11-12","12","Old Town Square","Markets on Old Town and Wenceslas squares",["family"],E("2026-11-28","2027-01-06","confirmed","https://www.pragueexperience.com/events/christmas-markets.asp"),None),
("CZ","Český Krumlov","Český Krumlov","culture","place","5-9","6-8","Český Krumlov","Medieval river-bend town with a castle and Baroque theatre",["family"],None,None),
# ---------------- Slovenia
("SI","Lake Bled","Bled","nature","place","5-9","6-8","Lake Bled","Island church, cliff castle and Vintgar Gorge nearby",["family"],None,None),
("SI","Soča River rafting","Bovec","nature","place","5-9","6-8","Soča","Emerald alpine river with rafting and canyoning from Bovec",["adrenaline"],None,None),
("SI","Postojna Cave","Postojna","nature","place","all","6-8","Postojna Cave","24 km cave system toured by electric train",["family"],None,None),
("SI","Ljubljana old town","Ljubljana","city","place","4-10","6-8","Ljubljana","Car-free riverside centre with bridges by Jože Plečnik",["budget","solo"],None,None),
# ---------------- Croatia
("HR","Dalmatian coast sailing","Hvar","beach","place","5-9","7-8","Hvar","Island-hop Hvar, Vis and Korčula by sailboat",["luxury","nightlife"],None,None),
("HR","Ultra Europe","Split","festival","event","7","7","Poljud Stadium","Electronic music festival in Split with island parties after",["nightlife"],E("2027-07-09","2027-07-11","confirmed","https://croatiaguidebook.com/entertainment/ultra-europe-split/"),None),
("HR","Plitvice Lakes","Plitvice","nature","place","4-10","5-6","Plitvice Lakes National Park","16 terraced lakes joined by waterfalls and wooden boardwalks",["family"],None,None),
# ---------------- Greece
("GR","Cyclades island hopping","Santorini","beach","place","5-10","6-9","Santorini","Ferries between Santorini, Naxos and Paros; caldera sunsets",["luxury","nightlife"],None,None),
("GR","Acropolis","Athens","culture","place","4-6,9-10","5,9","Acropolis of Athens","Parthenon and Acropolis Museum, best outside midsummer heat",["family"],None,None),
("GR","Orthodox Easter on Corfu","Corfu","festival","event","5","5","Corfu (city)","Pot-throwing and midnight fireworks; Easter is May 2 in 2027",["family"],E("2027-05-01","2027-05-02","confirmed","https://www.timeanddate.com/holidays/us/orthodox-easter-day"),None),
# ---------------- Turkey
("TR","Cappadocia balloons","Göreme","nature","place","4-6,9-10","5,9","Göreme","Sunrise balloon flights over fairy chimneys and cave hotels",["luxury","family"],None,None),
("TR","Istanbul food and bazaars","Istanbul","food","place","all","4-5,9-10","Grand Bazaar, Istanbul","Grand Bazaar, spice market and meyhane dinners on the Bosphorus",["budget","solo"],None,None),
("TR","Turquoise Coast sailing","Fethiye","beach","place","5-10","6-9","Ölüdeniz","Gulet cruises past Ölüdeniz lagoon and Lycian ruins",["luxury","family"],None,None),
("TR","Turkish Grand Prix","Istanbul","sports","event","10","10","Istanbul Park","F1 returns to Istanbul Park in 2027, subject to FIA approval",["adrenaline"],E("2027-10-01","2027-10-03","estimated",F1_27),None),
# ---------------- UAE
("AE","Dubai winter sun and shopping","Dubai","city","place","11-3","12-2","Burj Khalifa","Beach clubs, mega malls and the Burj Khalifa at 25 °C in winter",["luxury","family"],None,None),
("AE","Abu Dhabi Grand Prix","Yas Island","sports","event","12","12","Yas Marina Circuit","Twilight season finale at Yas Marina",["luxury"],E("2026-12-04","2026-12-06","confirmed",F1_26),None),
("AE","Dubai desert safari","Dubai Desert Conservation Reserve","nature","place","10-4","12-2","Dubai Desert Conservation Reserve","Dune drives, falconry and camp dinners outside the city",["family","adrenaline"],None,None),
# ---------------- Saudi Arabia
("SA","AlUla heritage","AlUla","culture","place","10-3","12-2","Hegra (Mada'in Salih)","Nabataean tombs at Hegra and sandstone canyons",["luxury"],None,None),
("SA","Riyadh Season","Riyadh","festival","event","10-12","11-12","Riyadh","Ten-week program of concerts, boxing and events from October 21",["nightlife","family"],E("2026-10-21","2026-12-29","estimated","https://www.spa.gov.sa/en/N2686677"),None),
("SA","Saudi Arabian Grand Prix","Jeddah","sports","event","3","3","Jeddah Corniche Circuit","Fastest street circuit on the calendar, along the Red Sea",["adrenaline"],E("2027-03-19","2027-03-21","confirmed",F1_27),None),
# ---------------- Qatar
("QA","Qatar Grand Prix","Lusail","sports","event","11","11","Lusail International Circuit","Night race under floodlights at Lusail",["adrenaline"],E("2026-11-27","2026-11-29","confirmed",F1_26),None),
("QA","Khor Al Adaid dunes","Khor Al Adaid","nature","place","11-3","12-2","Khor Al Adaid","Inland sea ringed by dunes, reached by 4x4",["adrenaline"],None,None),
("QA","Museum of Islamic Art","Doha","culture","place","11-3","12-2","Museum of Islamic Art, Doha","I. M. Pei museum on the Corniche with 1,400 years of art",["family","solo"],None,None),
# ---------------- Bahrain
("BH","Bahrain Grand Prix","Sakhir","sports","event","10,3","10,3","Bahrain International Circuit","F1 at Sakhir: October 2026, then the 2027 opener in March",["adrenaline"],E("2026-10-02","2026-10-04","confirmed",F1_26),None),
("BH","Bahrain Pearling Trail","Muharraq","culture","place","11-3","12-2","Pearling, Testimony of an Island Economy","UNESCO trail through pearl merchants' houses in Muharraq",["solo"],None,None),
("BH","Bahrain Fort","Manama","culture","place","11-3","12-2","Qal'at al-Bahrain","Dilmun-era tell and Portuguese fort on the north coast",["family"],None,None),
# ---------------- Oman
("OM","Wadi Shab","Tiwi","nature","place","10-4","12-2","Wadi Shab","Hike and swim through turquoise pools to a cave waterfall",["adrenaline","family"],None,None),
("OM","Musandam diving","Khasab","nature","place","10-4","11-3","Musandam Governorate","Fjord-like khors with dhow trips, dolphins and reef dives",["adrenaline"],None,"beach"),
("OM","Wahiba Sands","Wahiba Sands","nature","place","10-4","12-2","Wahiba Sands","Desert camps among 100 m dunes",["family"],None,None),
# ---------------- Jordan
("JO","Petra","Wadi Musa","culture","place","3-5,9-11","4,10","Petra","Rock-cut Nabataean city reached through the Siq",["family","solo"],None,None),
("JO","Wadi Rum","Wadi Rum","nature","place","3-5,9-11","4,10","Wadi Rum","Red sandstone desert with Bedouin camps and jeep tours",["adrenaline"],None,None),
("JO","Dead Sea float","Dead Sea","wellness","place","all","3-5,10-11","Dead Sea","Float in water ten times saltier than the ocean at -430 m",["family","wellness"],None,None),
# ---------------- Egypt
("EG","Giza pyramids","Giza","culture","place","10-4","12-2","Giza pyramid complex","The Great Pyramid and the new Grand Egyptian Museum",["family"],None,None),
("EG","Nile cruise","Luxor","culture","place","10-4","12-2","Karnak","Luxor to Aswan by boat, with Karnak and the Valley of the Kings",["family","luxury"],None,None),
("EG","Dahab diving","Dahab","nature","place","all","4-6,9-11","Blue Hole (Red Sea)","Reef diving and freediving at the Blue Hole",["budget","adrenaline"],None,"beach"),
("EG","Hurghada Red Sea","Hurghada","beach","place","all","4-6,9-11","Hurghada","Reef snorkeling and resorts on the Red Sea coast",["family","budget"],None,None),
# ---------------- Morocco
("MA","Marrakech medina","Marrakech","city","place","3-5,9-11","4,10","Jemaa el-Fnaa","Souks, riads and night food stalls on Jemaa el-Fnaa",["budget","solo"],None,None),
("MA","Sahara camps at Merzouga","Merzouga","nature","place","3-5,9-11","10-11","Erg Chebbi","Camel treks into Erg Chebbi dunes and desert camps",["adrenaline"],None,None),
("MA","Taghazout surf","Taghazout","surf","place","10-4","12-2","Taghazout","Right-hand point breaks such as Anchor Point near Agadir",["budget","solo"],None,None),
("MA","Atlas Mountains trekking","Imlil","nature","place","4-10","5-6,9","Toubkal","Trek from Imlil to Toubkal, North Africa's highest peak",["adrenaline"],None,None),
# ---------------- Kenya
("KE","Masai Mara migration","Masai Mara","nature","place","7-10","8-9","Maasai Mara","Wildebeest river crossings on the Mara River",["luxury","family"],None,None),
("KE","Diani kitesurfing","Diani Beach","surf","place","12-3,7-9","1-2,7-8","Diani Beach","Trade-wind kitesurfing on a reef-protected beach",["adrenaline"],None,None),
("KE","Amboseli elephants","Amboseli","nature","place","6-10,1-2","7-9","Amboseli National Park","Elephant herds under Kilimanjaro views",["family"],None,None),
# ---------------- Tanzania
("TZ","Serengeti calving","Ndutu","nature","place","1-2","2","Serengeti National Park","Wildebeest calving season on the southern plains",["luxury"],None,None),
("TZ","Kilimanjaro climb","Moshi","nature","place","1-3,6-10","1-2,8-9","Mount Kilimanjaro","Five- to eight-day trek to Africa's highest summit",["adrenaline","solo"],None,None),
("TZ","Zanzibar beaches","Nungwi","beach","place","6-10","7-9","Nungwi","White-sand beaches and dhow sunsets north of Stone Town",["family","luxury"],None,None),
# ---------------- Rwanda
("RW","Gorilla trekking in Volcanoes","Musanze","nature","place","6-9,12-2","6-8","Volcanoes National Park","Permit hikes to mountain gorilla families on the Virunga volcanoes",["luxury"],None,None),
("RW","Nyungwe canopy walk","Nyungwe","nature","place","6-9,12-2","6-8","Nyungwe Forest National Park","Chimpanzee tracking and a canopy walkway in montane rainforest",["adrenaline"],None,None),
("RW","Lake Kivu","Gisenyi","beach","place","6-9,12-2","7-8","Lake Kivu","Lake beaches and kayaking between the islands",["budget","family"],None,None),
# ---------------- Uganda
("UG","Bwindi gorilla trekking","Bwindi","nature","place","6-9,12-2","6-8","Bwindi Impenetrable National Park","Home to about half of the world's mountain gorillas",["adrenaline"],None,None),
("UG","Murchison Falls","Murchison Falls","nature","place","6-9,12-2","1-2","Murchison Falls National Park","The Nile forces through a 7 m gap; boat trips to the base",["family"],None,None),
("UG","Jinja rafting on the Nile","Jinja","nature","place","6-9,12-2","7-8","Jinja, Uganda","Grade 5 rapids near the source of the White Nile",["adrenaline"],None,None),
# ---------------- South Africa
("ZA","Kruger safari","Kruger","nature","place","5-9","7-9","Kruger National Park","Dry-season Big Five drives in one of Africa's largest parks",["family","budget"],None,None),
("ZA","Cape Town and the Winelands","Cape Town","food","place","11-3","12-2","Stellenbosch","Table Mountain, then Stellenbosch and Franschhoek wine estates",["luxury"],None,None),
("ZA","Hermanus whale watching","Hermanus","nature","place","7-11","9-10","Hermanus","Southern right whales visible from the cliff path",["family"],None,"marine"),
("ZA","Jeffreys Bay surf","Jeffreys Bay","surf","place","6-8","7","Jeffreys Bay","Supertubes, one of the longest right-hand point breaks",["adrenaline"],None,None),
# ---------------- Botswana
("BW","Okavango Delta","Maun","nature","place","6-10","7-9","Okavango Delta","Mokoro canoe safaris in the flooded inland delta",["luxury"],None,None),
("BW","Chobe elephants","Kasane","nature","place","6-10","8-10","Chobe National Park","River cruises past large elephant herds",["family"],None,None),
("BW","Makgadikgadi Pans","Makgadikgadi","nature","place","4-10","6-8","Makgadikgadi Pan","Salt pans with meerkats and quad-bike trips",["adrenaline"],None,None),
# ---------------- Namibia
("NA","Sossusvlei dunes","Sossusvlei","nature","place","5-10","6-8","Sossusvlei","Red dunes like Big Daddy and the dead trees of Deadvlei",["solo","adrenaline"],None,None),
("NA","Etosha wildlife","Etosha","nature","place","5-10","7-9","Etosha National Park","Dry-season waterholes crowded with elephants and rhino",["family"],None,None),
("NA","Skeleton Coast","Skeleton Coast","nature","place","5-10","7-9","Skeleton Coast","Shipwrecks, seal colonies and fog-bound desert coast",["adrenaline"],None,None),
# ---------------- Zambia
("ZM","Victoria Falls, Zambia side","Livingstone","nature","place","2-5","3-4","Victoria Falls","Peak flow spray and rainbows over the Zambezi gorge",["family"],None,None),
("ZM","Devil's Pool","Livingstone Island","nature","place","8-12","9-10","Livingstone Island","Swim at the lip of the falls when the river is low",["adrenaline"],None,None),
("ZM","South Luangwa walking safari","Mfuwe","nature","place","6-10","8-10","South Luangwa National Park","Birthplace of the walking safari, known for leopards",["luxury"],None,None),
# ---------------- Zimbabwe
("ZW","Victoria Falls, Zimbabwe side","Victoria Falls","nature","place","2-5","3-4","Victoria Falls (town)","Rainforest trail with front-on views of the main falls",["family"],None,None),
("ZW","Zambezi rafting","Batoka Gorge","nature","place","8-12","9-11","Batoka Gorge","Big-volume rapids below the falls at low water",["adrenaline"],None,None),
("ZW","Hwange safari","Hwange","nature","place","7-10","8-10","Hwange National Park","Large elephant herds at dry-season pans",["luxury"],None,None),
# ---------------- Madagascar
("MG","Avenue of the Baobabs","Morondava","nature","place","4-11","6-9","Avenue of the Baobabs","Giant Grandidier's baobabs lining a dirt road at sunset",["solo"],None,None),
("MG","Andasibe lemurs","Andasibe","nature","place","4-11","9-11","Andasibe-Mantadia National Park","Indri lemurs calling through rainforest near Antananarivo",["family"],None,None),
("MG","Nosy Be","Nosy Be","beach","place","4-12","9-11","Nosy Be","Island beaches, whale sharks and ylang-ylang plantations",["family"],None,None),
# ---------------- Mauritius
("MU","Le Morne beaches","Le Morne","beach","place","4-12","9-11","Le Morne Brabant","Lagoon beaches under the UNESCO Le Morne mountain",["luxury","family"],None,None),
("MU","Blue Bay diving","Mahébourg","nature","place","4-12","10-12","Blue Bay Marine Park","Coral gardens in a marine park lagoon",["family"],None,"beach"),
("MU","Black River Gorges","Chamarel","nature","place","5-11","6-9","Black River Gorges National Park","Forest trails and waterfalls, near the Chamarel coloured earth",["family"],None,None),
# ---------------- Seychelles
("SC","Anse Source d'Argent","La Digue","beach","place","4-12","4-5,10-11","Anse Source d'Argent","Granite boulders and shallow turquoise water on La Digue",["luxury"],None,None),
("SC","Vallée de Mai","Praslin","nature","place","4-12","4-5,10-11","Vallée de Mai","Palm forest home to the coco de mer",["family"],None,None),
("SC","Seychelles diving","Mahé","nature","place","4-12","4-5,10-11","Sainte Anne Marine National Park","Reef dives and whale shark season around Mahé",["adrenaline"],None,"beach"),
# ---------------- Japan
("JP","Niseko powder","Niseko","ski","place","12-3","1-2","Niseko","Siberian storms deliver deep, light powder on Mount Niseko-Annupuri",["adrenaline","family"],None,None),
("JP","Hakuba skiing","Hakuba","ski","place","12-3","1-2","Hakuba Valley","Ten resorts in the Northern Alps, 1998 Olympic venue",["family","nightlife"],None,None),
("JP","Sapporo Snow Festival","Sapporo","festival","event","2","2","Odori Park","Giant snow and ice sculptures in Odori Park",["family"],E("2027-02-04","2027-02-11","confirmed","https://www.sapporo.travel/en/event/event-list/sapporo_snow_festival/"),None),
("JP","Cherry blossoms in Kyoto","Kyoto","nature","place","3-4","4","Philosopher's Path","Late March to early April blossoms along canals and temples",["family","solo"],None,None),
("JP","Japanese Grand Prix","Suzuka","sports","event","4","4","Suzuka International Racing Course","Figure-eight track, a sprint weekend in 2027",["adrenaline"],E("2027-04-09","2027-04-11","confirmed",F1_27),None),
("JP","Gion Matsuri","Kyoto","festival","event","7","7","Yasaka Shrine","Month-long festival with float parades on July 17 and 24",["family"],E("2027-07-01","2027-07-31","confirmed","https://www.hey-japan.com/event/gion-festival"),None),
("JP","Mount Fuji climb","Fujiyoshida","nature","place","7-9","8","Mount Fuji","Official climbing season with huts on the Yoshida Trail",["adrenaline"],None,None),
("JP","Hakone onsen","Hakone","wellness","place","all","11","Hakone","Hot-spring ryokan with Fuji views and autumn leaves",["luxury"],None,None),
# ---------------- South Korea
("KR","Seoul cherry blossoms","Seoul","nature","place","4","4","Yeouido","Yeouido riverside blossoms in early April",["family"],None,None),
("KR","Seoul food and nightlife","Seoul","nightlife","place","all","5,10","Hongdae","Night markets, Korean barbecue and late bars in Hongdae",["nightlife","solo"],None,None),
("KR","K-pop concerts","Seoul","concert","place","all","5-10","Gocheok Sky Dome","Arena tours at Gocheok Sky Dome and KSPO Dome",["solo"],None,None),
("KR","Seoraksan fall foliage","Sokcho","nature","place","10-11","10","Seoraksan","Granite peaks and red maples in late October",["family"],None,None),
("KR","Pyeongchang skiing","Pyeongchang","ski","place","12-2","1","Yongpyong Resort","Yongpyong, host of the 2018 Olympic alpine events",["family"],None,None),
# ---------------- China
("CN","Harbin Ice Festival","Harbin","festival","event","1-2","1","Harbin Ice and Snow World","Illuminated ice castles; opening ceremony reported for January 5",["family"],E("2027-01-05","2027-02-28","estimated","https://www.lyriktrip.com/en-GB/guides/harbin-travel-guide"),None),
("CN","Great Wall at Mutianyu","Beijing","culture","place","4-5,9-10","10","Mutianyu","Restored watchtowers with a toboggan ride down",["family"],None,None),
("CN","Zhangjiajie pillars","Zhangjiajie","nature","place","4-10","4-5,9-10","Zhangjiajie National Forest Park","Sandstone pillars and the glass bridge",["adrenaline"],None,None),
("CN","Chinese Grand Prix","Shanghai","sports","event","4","4","Shanghai International Circuit","F1 at the Shanghai International Circuit",["adrenaline"],E("2027-04-16","2027-04-18","confirmed",F1_27),None),
# ---------------- Hong Kong
("HK","Hong Kong Sevens","Kai Tak","sports","event","4","4","Kai Tak Sports Park","Rugby sevens and costumed crowds at the new Kai Tak Stadium",["nightlife"],E("2027-04-09","2027-04-11","confirmed","https://www.hksevens.com/"),None),
("HK","Dim sum","Hong Kong","food","place","all","10-4","Tim Ho Wan","Dim sum from Michelin-starred Tim Ho Wan to old teahouses",["budget","family"],None,None),
("HK","Dragon's Back hike","Shek O","nature","place","10-4","11-2","Dragon's Back","Ridge walk above Shek O beach on Hong Kong Island",["family"],None,None),
# ---------------- Taiwan
("TW","Pingxi sky lanterns","Pingxi","festival","event","2","2","Pingxi District","Mass lantern release on the Lantern Festival night",["family"],E("2027-02-20","2027-02-20","estimated","https://www.travelbeginsat40.com/event/pingxi-sky-lantern-festival-taiwan/"),None),
("TW","Taipei night markets","Taipei","food","place","all","10-4","Shilin Night Market","Stinky tofu, pepper buns and bubble tea at Shilin and Raohe",["budget","family"],None,None),
("TW","Taroko Gorge","Hualien","nature","place","10-4","11-3","Taroko National Park","Marble canyon trails; check closures after the 2024 quake",["adrenaline"],None,None),
# ---------------- Thailand
("TH","Koh Tao diving","Koh Tao","nature","place","11-4","3-4","Ko Tao","Budget dive certifications and reef sites in the Gulf",["budget","solo"],None,"beach"),
("TH","Phi Phi and Andaman beaches","Krabi","beach","place","11-4","12-2","Phi Phi Islands","Limestone islands and long-tail boat trips",["nightlife","family"],None,None),
("TH","Songkran","Bangkok","festival","event","4","4","Khao San Road","Nationwide water fight for Thai New Year",["nightlife","budget"],E("2027-04-13","2027-04-15","confirmed","https://www.timeanddate.com/holidays/thailand/2027"),None),
("TH","Yi Peng lanterns","Chiang Mai","festival","event","11","11","Chiang Mai","Sky lanterns and Loy Krathong river offerings",["family"],E("2026-11-24","2026-11-25","confirmed","https://www.thailandhighlights.com/thailand/lantern-festivals"),None),
("TH","Bangkok street food and Muay Thai","Bangkok","food","place","all","11-2","Rajadamnern Stadium","Street food on Yaowarat and fights at Rajadamnern Stadium",["budget","nightlife"],None,None),
# ---------------- Vietnam
("VN","Ha Long Bay","Ha Long","nature","place","3-5,9-11","4,10","Hạ Long Bay","Overnight junk cruises among 1,600 limestone islets",["family","luxury"],None,None),
("VN","Hoi An lantern nights","Hội An","culture","place","all","2-4","Hội An","Old town turns off lights for lanterns each full moon",["family"],None,None),
("VN","Ha Giang loop","Hà Giang","nature","place","9-11","10","Hà Giang province","Four-day motorbike loop over the Mã Pí Lèng Pass",["adrenaline","solo"],None,None),
("VN","Tet in Hanoi","Hanoi","festival","event","2","2","Hoàn Kiếm Lake","Lunar New Year, February 6 in 2027, with fireworks at Hoàn Kiếm",["family"],E("2027-02-06","2027-02-06","confirmed","https://www.myvietnamvisa.com/vietnamese-lunar-new-year-dates-animals-of-the-zodiac.html"),None),
# ---------------- Cambodia
("KH","Angkor Wat","Siem Reap","culture","place","11-3","12-1","Angkor Wat","Sunrise over the world's largest religious monument",["family","solo"],None,None),
("KH","Koh Rong beaches","Koh Rong","beach","place","11-4","12-2","Koh Rong","Quiet island beaches and bioluminescent plankton",["budget","solo"],None,None),
("KH","Phnom Penh riverside","Phnom Penh","city","place","11-3","12-1","Royal Palace, Phnom Penh","Royal Palace, the central market and riverfront bars",["budget"],None,None),
# ---------------- Indonesia
("ID","Uluwatu surf","Uluwatu","surf","place","4-10","6-8","Uluwatu Temple","Left-hand reef break below the clifftop temple",["adrenaline","nightlife"],None,None),
("ID","Raja Ampat diving","Waigeo","nature","place","10-4","11-3","Raja Ampat Islands","Richest marine biodiversity on Earth, liveaboard trips",["luxury","adrenaline"],None,"beach"),
("ID","Komodo dragons","Labuan Bajo","nature","place","4-11","7-9","Komodo National Park","See dragons on Rinca and dive with mantas",["adrenaline"],None,None),
("ID","Ubud yoga retreats","Ubud","wellness","place","all","5-9","Ubud","Rice-terrace yoga shalas and retreat centers",["solo","wellness"],None,None),
# ---------------- Philippines
("PH","Cloud 9 surf","Siargao","surf","place","9-11","9-10","Siargao","Hollow right reef break at General Luna",["adrenaline","budget"],None,None),
("PH","El Nido island hopping","El Nido","beach","place","11-5","1-4","El Nido, Palawan","Lagoons and limestone cliffs of Bacuit Bay",["family"],None,None),
("PH","Coron wreck diving","Coron","nature","place","11-5","1-4","Coron, Palawan","Japanese WWII wrecks in shallow bays",["adrenaline"],None,"beach"),
# ---------------- Malaysia
("MY","Borneo orangutans","Sandakan","nature","place","3-10","4-9","Sepilok Orang Utan Rehabilitation Centre","Feeding times at Sepilok near Sandakan",["family"],None,None),
("MY","Mount Kinabalu","Kundasang","nature","place","3-10","4-9","Mount Kinabalu","Two-day climb to a granite summit at 4,095 m",["adrenaline"],None,None),
("MY","Sipadan diving","Semporna","nature","place","4-12","7-9","Sipadan","Turtle and barracuda walls; permits limited daily",["adrenaline"],None,"beach"),
# ---------------- Singapore
("SG","Singapore Grand Prix","Marina Bay","sports","event","10","10","Marina Bay Street Circuit","Night race through downtown Marina Bay",["luxury","nightlife"],E("2026-10-09","2026-10-11","confirmed",F1_26),None),
("SG","Hawker food","Singapore","food","place","all","2-4","Maxwell Food Centre","UNESCO-listed hawker culture at Maxwell and Lau Pa Sat",["budget","family"],None,None),
("SG","Gardens by the Bay","Singapore","city","place","all","2-4","Gardens by the Bay","Supertree Grove light show and cooled flower domes",["family"],None,None),
# ---------------- Maldives
("MV","Overwater villas","North Malé Atoll","beach","place","11-4","1-3","North Malé Atoll","Overwater villas above house reefs",["luxury"],None,None),
("MV","Manta diving at Hanifaru","Baa Atoll","nature","place","11-4","1-3","Hanifaru Bay","Manta ray feeding aggregations in Baa Atoll",["adrenaline"],None,"beach"),
("MV","Maafushi local island","Maafushi","beach","place","11-4","1-3","Maafushi","Guesthouse island for Maldives on a budget",["budget"],None,None),
# ---------------- Sri Lanka
("LK","Arugam Bay surf","Arugam Bay","surf","place","5-10","6-8","Arugam Bay","East coast right-hand point break",["budget","solo"],None,None),
("LK","Yala leopards","Yala","nature","place","2-6","3-5","Yala National Park","One of the highest leopard densities in the world",["family"],None,None),
("LK","Esala Perahera","Kandy","festival","event","7-8","8","Temple of the Tooth","Torch-lit elephant processions for the Sacred Tooth Relic",["family"],None,None),
("LK","Sigiriya","Sigiriya","culture","place","1-4","2-3","Sigiriya","Fifth-century rock fortress with frescoes",["family"],None,None),
# ---------------- India
("IN","Holi in Mathura","Mathura","festival","event","3","3","Mathura","Color festival at its Krishna birthplace roots; March 22 in 2027",["nightlife","budget"],E("2027-03-22","2027-03-22","confirmed","https://www.timeanddate.com/holidays/us/hindu-holi"),None),
("IN","Diwali in Jaipur","Jaipur","festival","event","11","11","Jaipur","City of lamps and fireworks; main day November 8 in 2026",["family"],E("2026-11-08","2026-11-08","confirmed","https://www.timeanddate.com/holidays/us/diwali"),None),
("IN","Rajasthan palaces","Udaipur","culture","place","10-3","12-2","City Palace, Udaipur","Lake palaces of Udaipur and forts of Jaipur and Jodhpur",["luxury"],None,None),
("IN","Goa beaches","Goa","beach","place","11-3","12-1","Palolem","Palm-lined beaches and shacks in south Goa",["nightlife","budget"],None,None),
("IN","Ladakh treks","Leh","nature","place","6-9","7-8","Leh","High-altitude treks and monasteries around Leh",["adrenaline"],None,None),
("IN","Ranthambore tigers","Sawai Madhopur","nature","place","10-6","3-5","Ranthambore National Park","Tiger safaris among ruined forts",["family"],None,None),
# ---------------- Nepal
("NP","Everest Base Camp trek","Khumbu","nature","place","3-5,10-11","4,10","Everest base camps","Twelve-day trek from Lukla to 5,364 m",["adrenaline","solo"],None,None),
("NP","Annapurna Circuit","Manang","nature","place","3-5,10-11","4,10","Annapurna Circuit","Loop over the 5,416 m Thorong La pass",["adrenaline","solo"],None,None),
("NP","Pokhara","Pokhara","nature","place","10-4","11","Pokhara","Lakeside town with paragliding and Himalaya views",["budget","adrenaline"],None,None),
# ---------------- Bhutan
("BT","Paro Tsechu","Paro","festival","event","3","3","Rinpung Dzong","Masked cham dances at Rinpung Dzong",["family"],E("2027-03-18","2027-03-22","confirmed","https://littlebhutan.com/travel-guide/paro-tshechu/"),None),
("BT","Tiger's Nest hike","Paro","nature","place","3-5,9-11","4,10","Paro Taktsang","Cliffside monastery 900 m above the Paro Valley",["family"],None,None),
("BT","Druk Path trek","Thimphu","nature","place","3-5,9-11","4,10","Thimphu","Five-day trek between Paro and Thimphu past alpine lakes",["adrenaline"],None,None),
# ---------------- Mongolia
("MN","Naadam Festival","Ulaanbaatar","festival","event","7","7","National Sports Stadium (Mongolia)","Wrestling, horse racing and archery",["family"],E("2027-07-11","2027-07-15","confirmed","https://naadamfestival.com/en"),None),
("MN","Gobi Desert","Gobi","nature","place","6-9","7-8","Khongoryn Els","Singing dunes and camel rides at Khongoryn Els",["adrenaline"],None,None),
("MN","Terelj ger camps","Terelj","nature","place","6-9","7","Gorkhi-Terelj National Park","Horse riding and ger stays an hour from Ulaanbaatar",["family","budget"],None,None),
# ---------------- Uzbekistan
("UZ","Samarkand","Samarkand","culture","place","4-6,9-10","5,9","Registan","Tiled madrasas of the Registan",["solo","family"],None,None),
("UZ","Bukhara","Bukhara","culture","place","4-6,9-10","5,9","Po-i-Kalyan","Silk Road old town around the Kalyan Minaret",["solo"],None,None),
("UZ","Khiva","Khiva","culture","place","4-6,9-10","5,9","Itchan Kala","Walled inner city of Itchan Kala",["solo"],None,None),
# ---------------- Australia
("AU","Australian Open","Melbourne","sports","event","1","1","Melbourne Park","First Grand Slam of the year at Melbourne Park",["family"],E("2027-01-11","2027-01-31","confirmed","https://www.melbournepark.com.au/event/australian-open-2027/"),None),
("AU","Australian Grand Prix","Melbourne","sports","event","4","4","Albert Park Circuit","Lakeside street circuit, a sprint weekend in April 2027",["nightlife"],E("2027-04-02","2027-04-04","confirmed",F1_27),None),
("AU","Great Barrier Reef","Cairns","nature","place","6-10","8-10","Great Barrier Reef","Reef trips from Cairns and Port Douglas in the dry season",["family","adrenaline"],None,"beach"),
("AU","Melbourne Cup","Flemington","sports","event","11","11","Flemington Racecourse","The race that stops a nation, first Tuesday in November",["luxury"],E("2026-11-03","2026-11-03","confirmed","https://www.timeanddate.com/holidays/australia/melbourne-cup-day"),None),
("AU","Uluru","Uluru","nature","place","5-9","6-8","Uluru","Sandstone monolith at sunrise, with the Field of Light nearby",["family"],None,None),
("AU","Sydney New Year's Eve","Sydney","festival","event","12","12","Sydney Harbour Bridge","Midnight fireworks off the Harbour Bridge",["nightlife","family"],E("2026-12-31","2026-12-31","confirmed","https://www.northsydney.nsw.gov.au/homepage/215/new-years-eve-2026"),None),
# ---------------- New Zealand
("NZ","Queenstown skiing","Queenstown","ski","place","6-9","7-8","The Remarkables","The Remarkables and Coronet Peak above Lake Wakatipu",["adrenaline","nightlife"],None,None),
("NZ","Queenstown bungy","Queenstown","nature","place","all","12-2","Kawarau Gorge Suspension Bridge","The first commercial bungy site, at Kawarau Bridge",["adrenaline"],None,None),
("NZ","Milford Track","Fiordland","nature","place","11-4","12-2","Milford Track","Four-day Great Walk to Milford Sound",["adrenaline","solo"],None,None),
("NZ","Mount Hutt skiing","Methven","ski","place","6-9","7-8","Mount Hutt","Canterbury ski field with a long season and Southern Alps views",["family"],None,None),
("NZ","Rugby at Eden Park","Auckland","sports","place","3-10","7-9","Eden Park","All Blacks tests and Super Rugby at New Zealand's national stadium",["family"],None,None),
# ---------------- Fiji
("FJ","Fiji diving","Taveuni","nature","place","5-10","7-9","Rainbow Reef","Soft coral at the Rainbow Reef in the Somosomo Strait",["adrenaline"],None,"beach"),
("FJ","Mamanuca island resorts","Mamanuca Islands","beach","place","5-10","7-9","Mamanuca Islands","Resort islands a short boat ride from Nadi",["family","luxury"],None,None),
("FJ","Cloudbreak surf","Tavarua","surf","place","5-9","6-8","Tavarua","Powerful left-hand reef break off Tavarua",["adrenaline"],None,None),
# ---------------- French Polynesia
("PF","Teahupo'o surf","Tahiti","surf","place","5-8","6-8","Teahupo'o","Heavy reef wave, 2024 Olympic surf venue",["adrenaline"],None,None),
("PF","Heiva i Tahiti","Papeete","festival","event","7","7","Papeete","Polynesian dance contest; no traditional Heiva in 2027",["family"],None,None),
("PF","Bora Bora overwater villas","Bora Bora","beach","place","5-10","6-9","Bora Bora","Lagoon bungalows under Mount Otemanu",["luxury"],None,None),
# ---------------- Antarctica
("AQ","Antarctic Peninsula cruise","Antarctic Peninsula","nature","place","11-3","12-1","Antarctic Peninsula","Expedition ships to penguin colonies and ice shelves",["luxury","adrenaline"],None,None),
("AQ","Lemaire Channel","Lemaire Channel","nature","place","11-3","12-1","Lemaire Channel","Narrow strait of towering cliffs and icebergs",["luxury"],None,None),
("AQ","Deception Island","South Shetland Islands","nature","place","11-3","1-2","Deception Island","Ship sails into a flooded volcanic caldera",["adrenaline"],None,None),
# ---------------- United States
("US","Aspen Snowmass","Aspen, Colorado","ski","place","12-3","1-3","Snowmass (ski area)","Four mountains on one pass, with Snowmass the largest",["luxury","nightlife"],None,None),
("US","Vail","Vail, Colorado","ski","place","12-3","1-3","Vail Ski Resort","5,300+ acres including the Back Bowls",["luxury","family"],None,None),
("US","Park City","Park City, Utah","ski","place","12-3","1-3","Park City Mountain Resort","Largest ski area in the US, 40 minutes from Salt Lake City",["family"],None,None),
("US","Jackson Hole","Teton Village, Wyoming","ski","place","12-3","1-3","Jackson Hole Mountain Resort","Steep terrain and Corbet's Couloir, with 4,139 ft of vertical",["adrenaline"],None,None),
("US","North Shore surf","Oahu","surf","place","11-2","12-1","Banzai Pipeline","Winter swells at Pipeline, Sunset and Waimea Bay",["adrenaline"],None,None),
("US","Yellowstone","Wyoming","nature","place","5-9","6-8","Old Faithful","Geysers, bison and Grand Prismatic Spring",["family"],None,None),
("US","Yosemite","California","nature","place","5-9","5-6","Yosemite Valley","Granite walls and waterfalls at peak flow in late spring",["family","adrenaline"],None,None),
("US","Alaska glaciers and bears","Katmai","nature","place","6-8","7","Brooks Falls","Brown bears catching salmon at Brooks Falls",["adrenaline"],None,None),
("US","Mardi Gras","New Orleans","festival","event","2","2","French Quarter","Parades from January 6 to Fat Tuesday, February 9 in 2027",["nightlife"],E("2027-02-09","2027-02-09","confirmed","https://www.neworleans.com/events/holidays-seasonal/mardi-gras/mardi-gras-parade-schedule/"),None),
("US","SXSW","Austin, Texas","festival","event","3","3","Austin Convention Center","Film, music and tech conference across downtown Austin",["nightlife","solo"],E("2027-03-15","2027-03-21","confirmed","https://sxsw.com/"),None),
("US","Coachella","Indio, California","festival","event","4","4","Empire Polo Club","Two weekends of music in the Colorado Desert",["nightlife"],E("2027-04-09","2027-04-18","estimated","https://www.sportingnews.com/us/tickets/news/coachella-2027-tickets-passes-pricing-dates-lineup-festival/e9961981411d64f65faa2a9c"),None),
("US","The Masters","Augusta, Georgia","sports","event","4","4","Augusta National Golf Club","Golf major at Augusta National",["luxury"],E("2027-04-08","2027-04-11","confirmed","https://www.skysports.com/golf/news/12176/13563739/golf-majors-in-2027-schedule-dates-venues-for-the-open-us-open-ryder-cup-and-more"),None),
("US","Kentucky Derby","Louisville, Kentucky","sports","event","5","5","Churchill Downs","The 153rd Derby at Churchill Downs",["luxury"],E("2027-05-01","2027-05-01","confirmed","https://www.kentuckyderby.com/tickets/2027/"),None),
("US","Burning Man","Black Rock City, Nevada","festival","event","8-9","8","Black Rock Desert","Temporary city of art in the Black Rock Desert",["adrenaline","solo"],E("2027-08-29","2027-09-06","confirmed","https://www.rgj.com/story/life/arts/burning-man/2026/09/08/burning-man-announces-2027s-theme-see-all-since-the-first-one-in-97/91662152007/"),None),
("US","Napa harvest","Napa, California","food","place","9-10","9-10","Napa Valley AVA","Crush season at Napa Valley wineries",["luxury"],None,None),
("US","New England foliage","Stowe, Vermont","nature","place","9-10","10","Stowe, Vermont","Peak color in Vermont's Green Mountains",["family"],None,None),
("US","United States Grand Prix","Austin, Texas","sports","event","10","10","Circuit of the Americas","F1 at the Circuit of the Americas",["nightlife"],E("2026-10-23","2026-10-25","confirmed",F1_26),None),
("US","Las Vegas Grand Prix","Las Vegas","sports","event","11","11","Las Vegas Strip Circuit","Night race down the Las Vegas Strip",["nightlife","luxury"],E("2026-11-19","2026-11-21","confirmed",F1_26),None),
# ---------------- Canada
("CA","Whistler skiing","Whistler","ski","place","12-4","1-3","Whistler Blackcomb","Two mountains linked by the Peak 2 Peak gondola",["family","nightlife"],None,None),
("CA","Banff and Lake Louise","Lake Louise","nature","place","6-9","7-8","Lake Louise","Turquoise lakes and trails to the Plain of Six Glaciers",["family"],None,None),
("CA","Quebec Winter Carnival","Quebec City","festival","event","2","2","Plains of Abraham","Ice palace, canoe racing and night parades",["family"],E("2027-02-05","2027-02-14","confirmed","https://carnaval.qc.ca/en/"),None),
("CA","Canadian Grand Prix","Montreal","sports","event","5","5","Circuit Gilles Villeneuve","Island circuit in Montreal, a sprint weekend in 2027",["nightlife"],E("2027-05-21","2027-05-23","confirmed",F1_27),None),
("CA","Montreal Jazz Festival","Montreal","concert","event","6-7","7","Quartier des Spectacles","Free outdoor stages across the Quartier des Spectacles",["family","budget"],E("2027-06-25","2027-07-04","confirmed","https://montrealjazzfest.com/en"),None),
("CA","Calgary Stampede","Calgary","festival","event","7","7","Stampede Park","Rodeo, chuckwagon races and a midway",["family"],E("2027-07-09","2027-07-18","confirmed","https://www.calgarystampede.com/"),None),
("CA","Churchill polar bears","Churchill, Manitoba","nature","place","10-11","11","Churchill, Manitoba","Tundra buggy tours as bears wait for Hudson Bay to freeze",["luxury"],None,None),
("CA","Yellowknife aurora","Yellowknife","nature","place","11-4","12-3","Yellowknife","Aurora on most clear winter nights under the auroral oval",["solo"],None,"aurora"),
# ---------------- Mexico
("MX","Día de los Muertos","Mexico City","festival","event","10-11","11","Zócalo","Parade on Reforma on October 31, ofrendas through November 2",["family"],E("2026-10-31","2026-11-02","confirmed","https://wheretostaymexico.com/news/day-of-the-dead-in-mexico-city-2026-parade-date-ofrendas-where-to-stay/"),None),
("MX","Mexico City food","Mexico City","food","place","all","3-5,10-11","Roma, Mexico City","Taco stands, mercados and tasting menus in Roma and Condesa",["budget","solo"],None,None),
("MX","Mexico City Grand Prix","Mexico City","sports","event","10-11","11","Autódromo Hermanos Rodríguez","Stadium section finish at the Autódromo",["nightlife"],E("2026-10-30","2026-11-01","confirmed",F1_26),None),
("MX","Monarch butterflies","Michoacán","nature","place","11-3","1-2","Monarch Butterfly Biosphere Reserve","Millions of monarchs wintering in fir forests",["family"],None,None),
("MX","Baja gray whales","Laguna San Ignacio","nature","place","1-4","2-3","Laguna San Ignacio","Gray whale mothers approach boats in the lagoon",["family"],None,"marine"),
("MX","Tulum cenotes","Tulum","nature","place","all","12-4","Gran Cenote","Swim and dive in clear freshwater cenotes",["family","adrenaline"],None,None),
("MX","Puerto Escondido surf","Puerto Escondido","surf","place","4-10","5-8","Zicatela Beach","Zicatela, the Mexican Pipeline",["adrenaline"],None,None),
# ---------------- Costa Rica
("CR","Santa Teresa surf","Santa Teresa","surf","place","12-4","1-3","Santa Teresa, Costa Rica","Consistent beach breaks on the Nicoya Peninsula",["solo","adrenaline"],None,None),
("CR","Monteverde zip lines","Monteverde","nature","place","12-4","1-3","Monteverde Cloud Forest Reserve","Cloud-forest zip lines and hanging bridges",["adrenaline","family"],None,None),
("CR","Tortuguero turtles","Tortuguero","nature","place","7-10","8-9","Tortuguero National Park","Green sea turtles nesting on the Caribbean beach",["family"],None,None),
# ---------------- Belize
("BZ","Great Blue Hole","Lighthouse Reef","nature","place","4-6","4-5","Great Blue Hole","125 m sinkhole dive with stalactites",["adrenaline"],None,"beach"),
("BZ","Ambergris Caye","San Pedro","beach","place","12-5","2-4","Ambergris Caye","Golf-cart island with Hol Chan snorkeling",["family"],None,None),
("BZ","Caracol ruins","Cayo","culture","place","12-5","2-4","Caracol","Largest Maya site in Belize, deep in the forest",["adrenaline"],None,None),
# ---------------- Guatemala
("GT","Semana Santa in Antigua","Antigua Guatemala","festival","event","3","3","Antigua Guatemala","Flower-carpet processions; Good Friday is March 26 in 2027",["family"],E("2027-03-21","2027-03-28","confirmed","https://cymantravel.com/semana-santa-antigua-guatemala/"),None),
("GT","Acatenango volcano hike","Acatenango","nature","place","11-4","12-2","Acatenango","Overnight hike to watch Fuego erupt",["adrenaline"],None,None),
("GT","Tikal","Petén","culture","place","11-4","12-2","Tikal","Maya temples rising over the jungle canopy",["family"],None,None),
("GT","Lake Atitlán","Panajachel","nature","place","11-4","12-2","Lake Atitlán","Volcano-ringed lake with Maya villages",["solo","budget"],None,None),
# ---------------- Bahamas
("BS","Exumas swimming pigs","Big Major Cay","beach","place","12-5","3-4","Big Major Cay","Swim with pigs at Pig Beach",["family"],None,None),
("BS","Exumas sailing","Great Exuma","beach","place","12-5","3-4","Exuma","Charter sailing through 365 cays",["luxury"],None,None),
("BS","Thunderball Grotto","Staniel Cay","nature","place","12-5","3-4","Staniel Cay","Snorkel inside the James Bond grotto",["family","adrenaline"],None,"beach"),
# ---------------- Dominican Republic
("DO","Samaná humpback whales","Samaná","nature","place","1-3","2","Samaná Bay","Humpbacks gather in the bay to mate and calve",["family"],None,"marine"),
("DO","Punta Cana beaches","Punta Cana","beach","place","12-4","2-3","Punta Cana","Palm beaches and all-inclusive resorts",["family","budget"],None,None),
("DO","Santo Domingo Zona Colonial","Santo Domingo","culture","place","11-4","2-3","Ciudad Colonial (Santo Domingo)","First European city in the Americas, UNESCO listed",["solo"],None,None),
# ---------------- Trinidad and Tobago
("TT","Trinidad Carnival","Port of Spain","festival","event","2","2","Queen's Park Savannah","J'ouvert and mas parades on Carnival Monday and Tuesday",["nightlife"],E("2027-02-08","2027-02-09","confirmed","https://visittrinidad.tt/things-to-do/carnival/"),None),
("TT","Tobago Buccoo Reef","Tobago","beach","place","1-5","2-4","Buccoo Reef","Glass-bottom boats and Pigeon Point beach",["family"],None,None),
("TT","Asa Wright birding","Arima","nature","place","1-5","2-4","Asa Wright Nature Centre","Rainforest lodge with oilbirds and hummingbirds",["solo"],None,None),
# ---------------- Barbados
("BB","Crop Over","Bridgetown","festival","event","7-8","8","Bridgetown","Summer festival ending with the Grand Kadooment parade",["nightlife"],E("2027-08-02","2027-08-02","estimated","https://carnivalvibez.com/barbados-crop-over-festival/"),None),
("BB","Carlisle Bay","Bridgetown","beach","place","12-4","2-4","Carlisle Bay","Snorkel over shipwrecks with turtles",["family"],None,None),
("BB","Harrison's Cave","St. Thomas","nature","place","all","2-4","Harrison's Cave","Tram tour through a limestone cave",["family"],None,None),
# ---------------- Brazil
("BR","Rio Carnival","Rio de Janeiro","festival","event","2","2","Sambadrome Marquês de Sapucaí","Samba school parades at the Sambadrome",["nightlife"],E("2027-02-05","2027-02-10","confirmed","https://www.riocarnaval.org/carnival-date/date"),None),
("BR","New Year's Eve at Copacabana","Rio de Janeiro","festival","event","12","12","Copacabana, Rio de Janeiro","Millions in white for fireworks over Copacabana",["nightlife","budget"],E("2026-12-31","2026-12-31","confirmed","https://copacabana.com/destaques/reveillon-2026"),None),
("BR","São Paulo Grand Prix","São Paulo","sports","event","11","11","Interlagos Circuit","Interlagos, a sprint weekend",["nightlife"],E("2026-11-06","2026-11-08","confirmed",F1_26),None),
("BR","Iguazu Falls, Brazil side","Foz do Iguaçu","nature","place","all","3-5","Iguazu Falls","275 falls across a 2.7 km horseshoe",["family"],None,None),
("BR","Jericoacoara kitesurfing","Jericoacoara","surf","place","7-12","9-11","Jericoacoara","Steady trade winds, dunes and lagoons",["adrenaline"],None,None),
# ---------------- Argentina
("AR","El Chaltén hiking","El Chaltén","nature","place","11-3","1-2","El Chaltén","Trails to Laguna de los Tres under Fitz Roy",["adrenaline","solo"],None,None),
("AR","Vendimia in Mendoza","Mendoza","food","event","3","3","Mendoza, Argentina","Grape harvest festival; central act March 6, 2027",["family"],E("2027-03-06","2027-03-07","confirmed","https://www.elsol.com.ar/mendoza/confirmaron-el-calendario-de-la-fiesta-nacional-de-la-vendimia-2027-cuando-sera-el-acto-central/"),None),
("AR","Bariloche skiing","Bariloche","ski","place","7-9","7-8","Cerro Catedral","Cerro Catedral above Nahuel Huapi lake",["family"],None,None),
("AR","Buenos Aires tango","Buenos Aires","culture","place","all","3-5,9-11","San Telmo","Milongas and street tango in San Telmo",["nightlife","solo"],None,None),
("AR","Iguazu Falls, Argentine side","Puerto Iguazú","nature","place","all","3-5","Devil's Throat","Catwalks right over the Devil's Throat",["family"],None,None),
# ---------------- Chile
("CL","Torres del Paine","Magallanes","nature","place","11-3","12-2","Torres del Paine National Park","W Trek to the granite towers",["adrenaline"],None,None),
("CL","Tapati Rapa Nui","Easter Island","festival","event","1-2","2","Hanga Roa","Two weeks of Rapa Nui sport and culture",["family"],E("2027-01-30","2027-02-12","confirmed","https://www.easterisland.travel/blog/tapati-rapa-nui-2027-easter-island/"),None),
("CL","Portillo skiing","Portillo","ski","place","7-9","7-8","Portillo, Chile","Classic Andes resort beside Laguna del Inca",["luxury"],None,None),
("CL","Valle Nevado skiing","Valle Nevado","ski","place","7-9","7-8","Valle Nevado","High Andes skiing an hour from Santiago",["family"],None,None),
("CL","Atacama stargazing","San Pedro de Atacama","nature","place","all","9-11","San Pedro de Atacama","Some of the clearest night skies on Earth",["solo"],None,None),
# ---------------- Peru
("PE","Machu Picchu","Aguas Calientes","culture","place","5-9","6-8","Machu Picchu","Inca citadel reached by the Inca Trail or train",["family","adrenaline"],None,None),
("PE","Inti Raymi","Cusco","festival","event","6","6","Sacsayhuamán","Inca sun festival reenacted at Sacsayhuamán on June 24",["family"],E("2027-06-24","2027-06-24","confirmed","https://www.cuscoperu.com/es/festividades-y-eventos/mayo-junio/inti-raymi/"),None),
("PE","Lima food","Lima","food","place","all","12-4","Miraflores District","Ceviche and tasting menus at Central and Maido",["luxury"],None,None),
# ---------------- Ecuador
("EC","Galápagos wildlife","Santa Cruz Island","nature","place","all","6-11","Galápagos Islands","Sea lions, giant tortoises and blue-footed boobies",["family","luxury"],None,None),
("EC","Quito old town","Quito","culture","place","6-9","7-8","Historic Center of Quito","Colonial centre at 2,850 m",["solo"],None,None),
("EC","Cotopaxi","Cotopaxi","nature","place","6-9","7-8","Cotopaxi","Hike to the refuge on a 5,897 m volcano",["adrenaline"],None,None),
# ---------------- Colombia
("CO","Barranquilla Carnival","Barranquilla","festival","event","2","2","Barranquilla","UNESCO-listed Caribbean carnival before Ash Wednesday",["nightlife"],E("2027-02-06","2027-02-09","confirmed","https://www.visitatlantico.com/en/carnival"),None),
("CO","Medellín Flower Festival","Medellín","festival","event","8","8","Medellín","Silleteros parade with flower displays",["family"],E("2027-07-30","2027-08-08","estimated","https://www.riotimesonline.com/medellin-flower-fair-2027-guide/"),None),
("CO","Cartagena old town","Cartagena","city","place","12-3","12-1","Walled City of Cartagena","Walled city streets and Rosario Islands day trips",["nightlife","luxury"],None,None),
("CO","Coffee region","Salento","food","place","12-3","12-2","Salento, Quindío","Coffee farm tours and wax palms in Cocora Valley",["budget"],None,None),
# ---------------- Bolivia
("BO","Salar de Uyuni mirror","Uyuni","nature","place","1-3","2","Salar de Uyuni","Rain turns the salt flat into a giant mirror",["solo","adrenaline"],None,None),
("BO","La Paz cable cars","La Paz","city","place","5-10","6-8","Mi Teleférico","World's largest urban cable car network",["budget"],None,None),
("BO","Lake Titicaca","Copacabana","nature","place","5-10","6-8","Isla del Sol","Inca ruins on Isla del Sol at 3,800 m",["budget"],None,None),
# ---------------- Uruguay
("UY","Punta del Este summer","Punta del Este","beach","place","12-2","1","Punta del Este","Beach clubs and the Hand sculpture at Playa Brava",["nightlife","luxury"],None,None),
("UY","José Ignacio","José Ignacio","beach","place","12-2","1","José Ignacio","Quiet lighthouse village and beach restaurants",["luxury"],None,None),
("UY","Colonia del Sacramento","Colonia","culture","place","10-4","1-2","Colonia del Sacramento","UNESCO cobbled quarter an hour by ferry from Buenos Aires",["family"],None,None),
]
