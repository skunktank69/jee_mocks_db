/* build_index.js
   Scans ../mocks_jsonl and builds an index JSON like:

   {
     "subjects": {
       "Physics": {
         "folderName": "Physics",
         "topics": {
           "Motion in a Plane": {
             "topic": "Motion in a Plane",
             "files": [
               {
                 "name": "Motion in a Plane.jsonl",
                 "relPath": "Physics/Motion in a Plane.jsonl"
               }
             ]
           }
         },
         "topicList": ["Motion in a Plane", "..."]
       }
     }
   }

   Usage:
     node build_index.js

   Optional env:
     INPUT=../mocks_jsonl
     OUTPUT=../mocks_jsonl/index.json
*/

const fs = require("fs/promises");
const path = require("path");

const INPUT_ROOT = path.resolve(
  __dirname,
  process.env.INPUT || "./mocks_jsonl",
);
const OUTPUT_FILE = path.resolve(
  __dirname,
  process.env.OUTPUT || "./mocks_jsonl/index.json",
);

function isJsonlFile(name) {
  return name.toLowerCase().endsWith(".jsonl");
}

function topicFromFile(fileName) {
  // "Motion in a Plane.jsonl" -> "Motion in a Plane"
  return fileName.replace(/\.jsonl$/i, "");
}

async function listDirs(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name);
}

async function listFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries.filter((e) => e.isFile()).map((e) => e.name);
}

async function main() {
  // Ensure input exists
  await fs.access(INPUT_ROOT);

  const subjects = {};
  const subjectDirs = await listDirs(INPUT_ROOT);

  for (const subjectName of subjectDirs) {
    const subjectPath = path.join(INPUT_ROOT, subjectName);

    const files = await listFiles(subjectPath);
    const jsonlFiles = files.filter(isJsonlFile);

    const topics = {};
    for (const fileName of jsonlFiles) {
      const topicName = topicFromFile(fileName);

      const relPath = path.join(subjectName, fileName).replaceAll("\\", "/");

      // Allow multiple files per topic if you ever add variants later
      if (!topics[topicName]) {
        topics[topicName] = {
          topic: topicName,
          files: [],
        };
      }

      topics[topicName].files.push({
        name: fileName,
        relPath,
      });
    }

    subjects[subjectName] = {
      folderName: subjectName,
      topics,
      topicList: Object.keys(topics).sort((a, b) => a.localeCompare(b)),
    };
  }

  const out = {
    subjects,
    subjectList: Object.keys(subjects).sort((a, b) => a.localeCompare(b)),
    generatedAt: new Date().toISOString(),
    inputRoot: INPUT_ROOT.replaceAll("\\", "/"),
  };

  await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(out, null, 2), "utf8");

  console.log(`Wrote index: ${OUTPUT_FILE}`);
  console.log(`Subjects: ${out.subjectList.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
