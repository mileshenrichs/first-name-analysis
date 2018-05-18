import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;

import javax.json.Json;
import javax.json.JsonArrayBuilder;
import javax.json.JsonObjectBuilder;
import java.io.BufferedWriter;
import java.io.FileWriter;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

/**
 * Scrape name analyses from list of baby names on kabalarians.com
 */

public class NameScraper {

    public static void main(String[] args) {
        try {
            Document doc = Jsoup.connect("https://www.kabalarians.com/cfm/top-100-baby-names.cfm").get();
            List<Element> links = doc.getElementsByTag("a");
            List<String> babyNameHrefs = new ArrayList<>();

            for(Element link : links) {
                String hrefValue = link.attr("href");
                if(hrefValue.contains("/name-meaning/")) {
                    babyNameHrefs.add("https://www.kabalarians.com" + hrefValue);
                }
            }

            List<String> nameSentences = new ArrayList<>();
            List<String> healthSentences = new ArrayList<>();

            for(int i = 0; i < 60; i++) {
                Document analysisDoc = Jsoup.connect(babyNameHrefs.get(i)).get();
                Elements lists = analysisDoc.select("div#headerOL ul");
                for(Element li : lists.get(0).getElementsByTag("li")) {
                    String text = li.text();
                    if(text.toLowerCase().substring(1).equals(text.substring(1))) {
                        nameSentences.add(li.text());
                    }
                }
                for(Element li : lists.get(1).getElementsByTag("li")) {
                    healthSentences.add(li.text());
                }
            }

            JsonObjectBuilder obj = Json.createObjectBuilder();
            JsonArrayBuilder nameSentencesArr = Json.createArrayBuilder();
            JsonArrayBuilder healthSentencesArr = Json.createArrayBuilder();

            for(String nameSentence : nameSentences) {
                nameSentencesArr.add(nameSentence);
            }
            for(String healthSentence : healthSentences) {
                healthSentencesArr.add(healthSentence);
            }

            obj.add("nameSentences", nameSentencesArr).add("healthSentences", healthSentencesArr);

            String jsonString = obj.build().toString();

            BufferedWriter writer = new BufferedWriter(new FileWriter("analysisSentences.txt"));
            writer.write(jsonString);
            writer.close();
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
}
