import axios from "axios";
import { load } from "cheerio";
import { Observable, from, map, zip } from "rxjs";
import * as fs from "fs";
import path from "path";
import { createHash } from 'crypto';

const URL = "http://www.radiobielefeld.de/nachrichten/lokalnachrichten.html";

interface News {
  header?: string;
  txt?: string;
  link?: string;
  date?: string;
  img?: string;
}

axios.get(URL).then((r) => {
  const $ = load(r.data);
  let links = $("#c1223 .news .list-news")
    .toArray()
    .map((e) => $(e).find("a")[0].attribs["href"]);
  zip(links.map((l) => loadNews(l))).subscribe((news) => {
    write(news);
  });
});

function loadNews(link: string): Observable<News> {
  const fullLink = "http://www.radiobielefeld.de/" + link;
  return from(axios.get(fullLink)).pipe(
    map((r) => {
      let $ = load(r.data);
      const header = $("h1").text();
      const txt = $(".news-text-wrap").text().trim();
      const dateSplit = $("meta[itemprop='datePublished']").attr("content")?.split("-") || [1,1,1]
      const date = new Date();
      date.setFullYear(dateSplit[0] as number);
      date.setMonth((dateSplit[1] as number) - 1);
      date.setDate(dateSplit[2] as number);
      const img = $("div.mediaelement img.img-responsive").attr("src");
      return { header, txt, link: fullLink, date: date.toISOString(), img};
    })
  );
}

function write(news: News[]) {
  let content = `<?xml version="1.0" encoding="utf-8"?>
      <rss version="2.0">
      <channel>
        <title>DD Radio Bielefeld Lokal</title>
        <pubDate>Erstellungsdatum(${new Date().toISOString()})</pubDate>
        <image>
        <url>https://www.radiobielefeld.de/</url>
        </image>
        ${news
          .map(
            (n) => `
        <item>
            <title>${n.header}</title>
            <description>
            <![CDATA[<img align="left" hspace="5" src="${n.img}"/>${n.txt}]]>
            </description>
            <link>${n.link}</link>
            <guid>${createHash('md5').update(n.link || '').digest('base64')}</guid>
            <pubDate>${n.date}</pubDate>
        </item>
        `
          )
          .join("")}
        </channel>
        </rss>
    `;
  fs.writeFileSync(path.join(".", "local-bi.xml"), content);
}
