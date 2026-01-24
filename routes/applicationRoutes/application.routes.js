const express = require("express");
const router = express.Router();
const prisma = require("../../prismaClient");

router.get("/ping", (req, res) => {
  res.json({ message: "Application route working" });
});

const normalizeUrl = (url) =>
  url.toLowerCase().trim().replace(/\/$/, "");

// create a test
router.post("/tests/create", async (req, res) => {
  const {
    title,
    companies = [],
    concepts = [],
    totalQuestions,
    totalTimeMin,
    easy = 0,
    medium = 0,
    hard = 0,
  } = req.body;

  // 1. Validations
  if (!title || !totalQuestions || !totalTimeMin) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  if (easy + medium + hard !== totalQuestions) {
    return res.status(400).json({
      error: "Sum of difficulties must equal totalQuestions",
    });
  }

  if (companies.length === 0 && concepts.length === 0) {
    return res.status(400).json({
      error: "At least one company or concept is required",
    });
  }

  try {
    // 2. Base filter
    const baseWhere = { AND: [] };

    if (companies.length > 0) {
      baseWhere.AND.push({
        companies: { some: { name: { in: companies } } },
      });
    }

    if (concepts.length > 0) {
      baseWhere.AND.push({
        concepts: { some: { name: { in: concepts } } },
      });
    }

    // 3. Fetch questions
    const fetchByDifficulty = async (difficulty, count) => {
      if (count === 0) return [];

      const qs = await prisma.question.findMany({
        where: { ...baseWhere, difficulty },
        orderBy: { priority: "asc" },
        take: count * 3,
      });

      if (qs.length < count) {
        throw new Error(`Not enough ${difficulty} questions`);
      }

      return qs.sort(() => 0.5 - Math.random()).slice(0, count);
    };

    const easyQs = await fetchByDifficulty("EASY", easy);
    const mediumQs = await fetchByDifficulty("MEDIUM", medium);
    const hardQs = await fetchByDifficulty("HARD", hard);

    const finalQuestions = [...easyQs, ...mediumQs, ...hardQs].sort(
      () => 0.5 - Math.random()
    );

    // 4. Create test
    const test = await prisma.test.create({
      data: {
        title,
        totalQuestions,
        totalTimeMin,
        easyCount: easy,
        mediumCount: medium,
        hardCount: hard,
        companies,
        concepts,
      },
    });

    // 5. Create TestQuestion rows
    await prisma.testQuestion.createMany({
      data: finalQuestions.map((q, index) => ({
        testId: test.id,
        questionUrl: normalizeUrl(q.questionUrl),
        orderIndex: index + 1,
      })),
    });

    // 6. Response
    res.json({
      testId: test.id,
      title: test.title,
      totalTimeMin,
      questions: finalQuestions.map((q, i) => ({
        order: i + 1,
        difficulty: q.difficulty,
        title: q.title,
        questionUrl: normalizeUrl(q.questionUrl),
      })),
    });
  } catch (err) {
    res.status(400).json({
      error: err.message || "Failed to create test",
    });
  }
});

// submit a test
router.post("/tests/:testId/submit", async (req, res) => {
  const { testId } = req.params;
  const {
    completionTimeMin,
    solvedCount,
    outcome,
    overallLearning,
    questions = [],
  } = req.body;

  if (!completionTimeMin || !outcome || !Array.isArray(questions)) {
    return res.status(400).json({ error: "Invalid submission data" });
  }

  try {
    // 1. Fetch test
    const test = await prisma.test.findUnique({
      where: { id: Number(testId) },
      include: { questions: true },
    });

    if (!test) {
      return res.status(404).json({ error: "Test not found" });
    }

    if (test.submitted) {
      return res.status(400).json({ error: "Test already submitted" });
    }

    if (test.questions.length === 0) {
      return res.status(400).json({
        error: "No questions found for this test",
      });
    }

    // 2. Update test
    await prisma.test.update({
      where: { id: test.id },
      data: {
        submitted: true,
        completionTimeMin,
        solvedCount,
        outcome,
        overallLearning,
        submittedAt: new Date(),
      },
    });

    // 3. Update TestQuestion rows
    for (const q of questions) {
      const normalizedUrl = normalizeUrl(q.questionUrl);

      const result = await prisma.testQuestion.updateMany({
        where: {
          testId: test.id,
          questionUrl: normalizedUrl,
        },
        data: {
          solved: q.solved,
          timeTakenMin: q.timeTakenMin,
          solution: q.solution,
          learning: q.learning,
          mainPoints: q.mainPoints,
        },
      });

      if (result.count === 0) {
        console.error("No TestQuestion updated for:", normalizedUrl);
      }

      // Increase priority only if solved
      if (q.solved === true) {
        await prisma.question.update({
          where: { questionUrl: normalizedUrl },
          data: {
            priority: { increment: 1 },
          },
        });
      }
    }

    res.json({
      message: "Test evaluated successfully",
      testId: test.id,
      solvedCount,
      totalQuestions: test.totalQuestions,
      outcome,
    });
  } catch (err) {
    res.status(500).json({
      error: "Failed to evaluate test",
      details: err.message,
    });
  }
});

// get all questions acc to the filters
router.get("/questions", async (req, res) => {
  const {
    company,
    concepts,
    difficulty,
    maxPriority,
    limit = 50,
    offset = 0,
  } = req.query;

  try {
    const where = {
      AND: [],
    };

    // Filter by company
    if (company) {
      where.AND.push({
        companies: {
          some: {
            name: company,
          },
        },
      });
    }

    // Filter by concepts (comma-separated)
    if (concepts) {
      const conceptList = concepts.split(",").map(c => c.trim());

      where.AND.push({
        concepts: {
          some: {
            name: {
              in: conceptList,
            },
          },
        },
      });
    }

    // Filter by difficulty
    if (difficulty) {
      where.AND.push({
        difficulty: difficulty.toUpperCase(),
      });
    }

    // Filter by priority (useful to get weak questions)
    if (maxPriority !== undefined) {
      where.AND.push({
        priority: {
          lte: Number(maxPriority),
        },
      });
    }

    const questions = await prisma.question.findMany({
      where: where.AND.length > 0 ? where : undefined,
      include: {
        concepts: {
          select: { name: true },
        },
        companies: {
          select: { name: true },
        },
      },
      orderBy: [
        { priority: "asc" },
        { difficulty: "asc" },
      ],
      take: Number(limit),
      skip: Number(offset),
    });

    res.json({
      total: questions.length,
      filters: {
        company,
        concepts,
        difficulty,
        maxPriority,
      },
      questions: questions.map(q => ({
        questionUrl: q.questionUrl,
        title: q.title,
        difficulty: q.difficulty,
        priority: q.priority,
        companies: q.companies.map(c => c.name),
        concepts: q.concepts.map(c => c.name),
        pattern: q.pattern,
        notes: q.notes,
        learning: q.learning,
      })),
    });
  } catch (err) {
    res.status(500).json({
      error: "Failed to fetch questions",
      details: err.message,
    });
  }
});

// get all tests list
router.get("/tests", async (req, res) => {
  try {
    const tests = await prisma.test.findMany({
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        title: true,
        createdAt: true,
        submitted: true,
        totalQuestions: true,
        solvedCount: true,
        outcome: true,
        completionTimeMin: true,
      },
    });

    res.json({
      totalTests: tests.length,
      tests,
    });
  } catch (err) {
    res.status(500).json({
      error: "Failed to fetch tests",
      details: err.message,
    });
  }
});

// get specific test details
router.get("/tests/:testId", async (req, res) => {
  const { testId } = req.params;

  try {
    const test = await prisma.test.findUnique({
      where: { id: Number(testId) },
      include: {
        questions: {
          orderBy: {
            orderIndex: "asc",
          },
          include: {
            question: {
              select: {
                title: true,
                difficulty: true,
              },
            },
          },
        },
      },
    });

    if (!test) {
      return res.status(404).json({ error: "Test not found" });
    }

    res.json({
      testId: test.id,
      title: test.title,
      createdAt: test.createdAt,
      submitted: test.submitted,
      submittedAt: test.submittedAt,
      totalTimeMin: test.totalTimeMin,
      completionTimeMin: test.completionTimeMin,
      outcome: test.outcome,
      overallLearning: test.overallLearning,
      totalQuestions: test.totalQuestions,
      solvedCount: test.solvedCount,
      questions: test.questions.map(q => ({
        order: q.orderIndex,
        questionUrl: q.questionUrl,
        title: q.question.title,
        difficulty: q.question.difficulty,
        solved: q.solved,
        timeTakenMin: q.timeTakenMin,
        solution: q.solution,
        learning: q.learning,
        mainPoints: q.mainPoints,
      })),
    });
  } catch (err) {
    res.status(500).json({
      error: "Failed to fetch test report",
      details: err.message,
    });
  }
});

// get all the concepts
router.get("/concepts", async (req, res) => {
  try {
    const concepts = await prisma.concept.findMany({
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
      },
    });

    res.json({
      totalConcepts: concepts.length,
      concepts,
    });
  } catch (err) {
    res.status(500).json({
      error: "Failed to fetch concepts",
      details: err.message,
    });
  }
});

// increment question priority
router.post("/questions/priority", async (req, res) => {
  const { questionUrl, action, value } = req.body;

  if (!questionUrl || !action) {
    return res.status(400).json({
      error: "questionUrl and action are required",
    });
  }

  const normalizedUrl = questionUrl.toLowerCase().replace(/\/$/, "");

  let priorityUpdate;

  if (action === "increment") {
    priorityUpdate = { increment: 1 };
  } else if (action === "decrement") {
    priorityUpdate = { decrement: 1 };
  } else if (action === "set") {
    if (typeof value !== "number" || value < 0) {
      return res.status(400).json({
        error: "value must be a non-negative number for set action",
      });
    }
    priorityUpdate = value;
  } else {
    return res.status(400).json({
      error: "Invalid action. Use increment, decrement, or set",
    });
  }

  try {
    const updated = await prisma.question.update({
      where: { questionUrl: normalizedUrl },
      data: {
        priority: priorityUpdate,
      },
      select: {
        questionUrl: true,
        priority: true,
      },
    });

    res.json({
      message: "Priority updated successfully",
      questionUrl: updated.questionUrl,
      newPriority: updated.priority,
      action,
    });
  } catch (err) {
    res.status(404).json({
      error: "Question not found",
      details: err.message,
    });
  }
});



// tracking total time spent and streak implementation
/*
Frontend calls start
  we store activeStart
Frontend later calls end
  we calculate duration = end − activeStart
  add to totalMinutes
  clear activeStart
  if totalMinutes >= 90 and not already counted → mark streak
*/

const STREAK_THRESHOLD_MINUTES = 90;

// start the study session
router.post("/streak/start", async (req, res) => {
  const { date, startTime } = req.body;

  if (!date || !startTime) {
    return res.status(400).json({
      error: "date and startTime are required",
    });
  }

  try {
    const day = await prisma.streakDay.upsert({
      where: { date },
      update: {
        activeStart: new Date(startTime),
      },
      create: {
        date,
        activeStart: new Date(startTime),
      },
    });

    res.json({
      message: "Study started",
      date: day.date,
      activeStart: day.activeStart,
    });
  } catch (err) {
    res.status(500).json({
      error: "Failed to start study",
      details: err.message,
    });
  }
});

// end the study session
router.post("/streak/end", async (req, res) => {
  const { date, endTime } = req.body;
  if (!date || !endTime) {
    return res.status(400).json({
      error: "date and endTime are required",
    });
  }
  try {
    const day = await prisma.streakDay.findUnique({
      where: { date },
    });

    if (!day || !day.activeStart) {
      return res.status(400).json({
        error: "No active study session found for this date",
      });
    }

    const start = new Date(day.activeStart);
    const end = new Date(endTime);

    const durationMinutes = Math.max(
      0,
      Math.floor((end - start) / (1000 * 60))
    );

    const newTotal = day.totalMinutes + durationMinutes;

    let streakIncremented = false;

    if (newTotal >= STREAK_THRESHOLD_MINUTES && !day.streakDone) {
      streakIncremented = true;
    }

    await prisma.streakDay.update({
      where: { date },
      data: {
        totalMinutes: newTotal,
        activeStart: null,
        streakDone: streakIncremented ? true : day.streakDone,
      },
    });

    res.json({
      message: "Study ended",
      addedMinutes: durationMinutes,
      totalMinutesToday: newTotal,
      streakIncremented,
    });
  } catch (err) {
    res.status(500).json({
      error: "Failed to end study",
      details: err.message,
    });
  }
});

// create pattern
router.post("/patterns", async (req, res) => {
  const { name, description, howToIdentify, relations, concepts = [] } = req.body;

  if (!name) {
    return res.status(400).json({ error: "pattern name is required" });
  }

  try {
    const pattern = await prisma.pattern.create({
      data: {
        name,
        description,
        howToIdentify,
        relations,
        concepts: {
          connect: concepts.map(c => ({ name: c })),
        },
      },
    });

    res.json({
      message: "Pattern created successfully",
      patternId: pattern.id,
    });
  } catch (err) {
    res.status(400).json({
      error: "Failed to create pattern",
      details: err.message,
    });
  }
});

// add question to that pattern
router.post("/patterns/:patternId/questions", async (req, res) => {
  const { patternId } = req.params;
  const { questionUrls } = req.body;

  if (!Array.isArray(questionUrls) || questionUrls.length === 0) {
    return res.status(400).json({ error: "questionUrls array is required" });
  }

  try {
    await prisma.pattern.update({
      where: { id: Number(patternId) },
      data: {
        questions: {
          connect: questionUrls.map(url => ({
            questionUrl: url.toLowerCase().replace(/\/$/, ""),
          })),
        },
      },
    });

    res.json({
      message: "Questions linked to pattern successfully",
      linkedCount: questionUrls.length,
    });
  } catch (err) {
    res.status(400).json({
      error: "Failed to link questions",
      details: err.message,
    });
  }
});

// get patterns list
router.get("/patterns", async (req, res) => {
  try {
    const patterns = await prisma.pattern.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
      },
    });

    res.json({
      totalPatterns: patterns.length,
      patterns,
    });
  } catch (err) {
    res.status(500).json({
      error: "Failed to fetch patterns",
      details: err.message,
    });
  }
});

// get questions under that pattern
router.get("/patterns/:patternId", async (req, res) => {
  const { patternId } = req.params;

  try {
    const pattern = await prisma.pattern.findUnique({
      where: { id: Number(patternId) },
      include: {
        concepts: {
          select: { name: true },
        },
        questions: {
          orderBy: { priority: "asc" },
          select: {
            questionUrl: true,
            title: true,
            difficulty: true,
            priority: true,
          },
        },
      },
    });

    if (!pattern) {
      return res.status(404).json({ error: "Pattern not found" });
    }

    res.json({
      id: pattern.id,
      name: pattern.name,
      description: pattern.description,
      howToIdentify: pattern.howToIdentify,
      relations: pattern.relations,
      concepts: pattern.concepts.map(c => c.name),
      totalQuestions: pattern.questions.length,
      questions: pattern.questions,
    });
  } catch (err) {
    res.status(500).json({
      error: "Failed to fetch pattern",
      details: err.message,
    });
  }
});

// delete pattern
router.delete("/patterns/:patternId", async (req, res) => {
  const { patternId } = req.params;

  try {
    // 1 Check pattern exists
    const pattern = await prisma.pattern.findUnique({
      where: { id: Number(patternId) },
    });

    if (!pattern) {
      return res.status(404).json({ error: "Pattern not found" });
    }

    // 2 Delete pattern (Prisma automatically clears M2M relations)
    await prisma.pattern.delete({
      where: { id: Number(patternId) },
    });

    res.json({
      message: "Pattern deleted successfully",
      patternId: Number(patternId),
    });
  } catch (err) {
    res.status(500).json({
      error: "Failed to delete pattern",
      details: err.message,
    });
  }
});

module.exports = router;
