import axios from "axios";
import { load } from "cheerio";
import { Observable, from, map, zip } from "rxjs";
import * as fs from "fs";
import path from "path";
import { createHash } from 'crypto';


interface News {
  title?: string,
  image: string,
  filename: string

  entries: {
    header?: string;
    txt?: string;
    link?: string;
    date?: string;
    img?: string;
  }[]
}


// loadRadioBielefeld();
loadEatClub();


function loadEatClub() {
  const URL = "https://www.eatclub.tv/aktuelles";

  axios.get(URL).then((r) => {
    const $ = load(r.data);
    let links = $(".entry-title a")
      .toArray()
      .map((e) => e.attribs["href"]);
    zip(links.map((l) => {
      return from(axios.get(l)).pipe(
        map((r) => {
          let $ = load(r.data);
          const header = $("h2.entry-title ").text();
          const txt = $(".article-body>p,.article-body ol,.article-body li").toArray().map(e => $(e).html()).join("<br/>");
          const date = $("time.entry-date").attr("datetime");
          const img = $(".post-thumbnail img").attr("src");
          return { header, txt, link: l, date: date, img };
        })
      );
    })).subscribe((news) => {
      write({
        filename: "eat-club.xml",
        image: "https://www.eatclub.tv/wp-content/uploads/2023/12/logo-ec-einzeilig-weiss.png",
        title: "EatClub",
        entries: news,
      });
    });
  });
}



function loadRadioBielefeld() {
  const URL = "http://www.radiobielefeld.de/nachrichten/lokalnachrichten.html";

  axios.get(URL).then((r) => {
    const $ = load(r.data);
    let links = $("#c1223 .news .list-news")
      .toArray()
      .map((e) => $(e).find("a")[0].attribs["href"]);
    zip(links.map((l) => {
      const fullLink = "http://www.radiobielefeld.de/" + l;
      return from(axios.get(fullLink)).pipe(
        map((r) => {
          let $ = load(r.data);
          const header = $("h1").text();
          const txt = $(".news-text-wrap").text().trim();
          const dateSplit = $("meta[itemprop='datePublished']").attr("content")?.split("-") || [1, 1, 1]
          const date = new Date();
          date.setFullYear(dateSplit[0] as number);
          date.setMonth((dateSplit[1] as number) - 1);
          date.setDate(dateSplit[2] as number);
          const img = $("div.mediaelement img.img-responsive").attr("src");
          return { header, txt, link: fullLink, date: date.toISOString(), img };
        })
      );
    })).subscribe((news) => {
      write({
        filename: "local-bi.xml",
        image: "https://upload.wikimedia.org/wikipedia/commons/3/34/Radio_Bielefeld_logo.svg",
        title: "Radio Bielefeld Lokal",
        entries: news,
      });
    });
  });
}

function write(news: News) {
  let content = `<?xml version="1.0" encoding="utf-8"?>
      <rss version="2.0">
      <channel>
        <title>${news.title}</title>
        <pubDate>Erstellungsdatum(${new Date().toISOString()})</pubDate>
        <image>
        <url>${news.image}</url>
        </image>
        ${news.entries.map(
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
  fs.writeFileSync(path.join(".", news.filename), content);
}
