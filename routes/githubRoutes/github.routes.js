const express = require("express");
const router = express.Router();
const axios = require("axios");
const csv = require("csv-parser");
const { Readable } = require("stream");
const prisma = require("../../prismaClient");


router.get("/ping", (req, res) => {
    res.json({ message: "GitHub route working" });
});


// inorder to get the link first go to your github repo and go to that csv file and then click on raw and copy that link

router.post("/import-company-csv", async (req, res) => {
  const { company, csvUrl } = req.body;

  if (!company || !csvUrl) {
    return res.status(400).json({
      error: "company and csvUrl are required",
    });
  }

  try {
    // 1 Fetch CSV
    const response = await axios.get(csvUrl, { responseType: "text" });
    const csvText = response.data.replace(/^\uFEFF/, "");

    const rows = [];

    // 2 Parse CSV
    await new Promise((resolve, reject) => {
      Readable.from(csvText)
        .pipe(
          csv({
            mapHeaders: ({ header }) =>
              header.replace(/^\uFEFF/, "").trim().toLowerCase(),
          })
        )
        .on("data", (row) => rows.push(row))
        .on("end", resolve)
        .on("error", reject);
    });

    // 3 Ensure company exists
    const companyRecord = await prisma.company.upsert({
      where: { name: company },
      update: {},
      create: { name: company },
    });

    // 4 Collect ALL unique topics once
    const uniqueTopics = new Set();

    rows.forEach(row => {
      if (row["topics"]) {
        row["topics"]
          .split(",")
          .map(t => t.trim())
          .filter(Boolean)
          .forEach(t => uniqueTopics.add(t));
      }
    });

    // 5 Insert all concepts at once
    await prisma.concept.createMany({
      data: Array.from(uniqueTopics).map(name => ({ name })),
      skipDuplicates: true,
    });

    // 6 Fetch all concepts into a map
    const allConcepts = await prisma.concept.findMany();
    const conceptMap = new Map(
      allConcepts.map(c => [c.name, c.id])
    );

    let processed = 0;

    // 7 Process each question (still sequential, but much faster)
    for (const row of rows) {
      const questionUrl = row["link"];
      if (!questionUrl) continue;

      const difficulty = row["difficulty"]?.toUpperCase();
      if (!["EASY", "MEDIUM", "HARD"].includes(difficulty)) continue;

      const topicIds = row["topics"]
        ? row["topics"]
            .split(",")
            .map(t => t.trim())
            .filter(Boolean)
            .map(t => conceptMap.get(t))
            .filter(Boolean)
        : [];

      await prisma.question.upsert({
        where: { questionUrl },
        update: {
          companies: {
            connect: { id: companyRecord.id },
          },
          concepts: {
            connect: topicIds.map(id => ({ id })),
          },
        },
        create: {
          questionUrl,
          title: row["title"],
          difficulty,
          priority: 0,
          companies: {
            connect: { id: companyRecord.id },
          },
          concepts: {
            connect: topicIds.map(id => ({ id })),
          },
        },
      });

      processed++;
    }

    res.json({
      message: "CSV imported into database successfully",
      company,
      totalRows: rows.length,
      questionsProcessed: processed,
      uniqueConcepts: uniqueTopics.size,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Failed to import CSV into DB",
      details: err.message,
    });
  }
});

module.exports = router;
