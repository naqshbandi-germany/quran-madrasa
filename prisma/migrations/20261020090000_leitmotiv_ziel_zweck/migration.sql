-- Leitmotiv "Islam unter Freunden" als Text der Seite "Ziel & Zweck". Ein bereits im
-- Admin-Bereich gepflegter Text wird nicht ueberschrieben.

INSERT INTO "SiteContent" ("id", "missionStatement", "updatedAt")
VALUES ('main', $leitmotiv$Unser Shaykh, Muhammad Adil, betont in seinen Lehrvorträgen immer wieder die besondere Bedeutung, vor allem jungen Muslimen den Heiligen Koran, gutes Adab und ein fundiertes Verständnis des islamischen Glaubens sowie seiner rechten Praxis zu vermitteln.

Aus dieser Überzeugung heraus möchte Islam unter Freunden unseren Youngsters die Grundlagen des Islams in einem familiären, entspannten und freudvollen Umfeld näherbringen – einem Ort, an dem sie Fragen stellen, Wissen erwerben und ihren Glauben gemeinsam mit anderen vertiefen können.

Viele Familien stehen vor der Herausforderung, einen geeigneten islamischen Unterricht für ihre Kinder zu finden. Insbesondere im Bereich des traditionellen sunnitischen Islams und der Tariqah fehlt es vielerorts an erreichbaren Lehrangeboten. Hinzu kommen finanzielle Hürden, die den Zugang zu fundiertem Religionsunterricht erschweren können.

Diesen Herausforderungen begegnen wir, indem wir qualitativen und quellentreuen Islamunterricht anbieten. Wir sind überzeugt, dass der Zugang zu Islamischen Wissen keine Barrieren haben sollte. Unser Anliegen ist es, unser wertvolles Erbe all jenen zugänglich zu machen, die sich der Religion nähern, ihr Wissen vertiefen und das Licht des Glaubens in ihren Herzen stärken möchten.

Dabei verstehen wir islamische Bildung nicht allein als die Vermittlung von Informationen, sondern als einen Weg der charakterlichen Entwicklung. Wir legen besonderen Wert darauf, die Glaubenslehre quellentreu zu vermitteln, gutes Adab zu fördern und die Liebe zum Heiligen Propheten Muhammad ﷺ zu stärken. Denn wahrhaftiges Wissen soll nicht nur unseren Verstand bereichern, sondern auch unsere Herzen reinigen, unseren Charakter verschönern und unser Handeln zum Guten motivieren.

Unser Leitgedanke ist daher: Wissen, das den Glauben stärkt, die Liebe zum Propheten ﷺ vertieft und uns zu besseren Menschen werden lässt – vermittelt in einer Gemeinschaft, in der Lernen Freude macht und der Islam unter Freunden lebendig wird.$leitmotiv$, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE
SET "missionStatement" = EXCLUDED."missionStatement", "updatedAt" = CURRENT_TIMESTAMP
WHERE btrim("SiteContent"."missionStatement") = '';
