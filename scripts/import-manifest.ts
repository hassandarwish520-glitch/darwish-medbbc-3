// @ts-nocheck
export type SubjectImportDocument = {
  key: string;
  subject: string;
  examCode: string;
  lessonTitle: string;
  localFilePath: string;
  sourceFileName: string;
  kind: "html" | "pdf";
  description: string;
  bundleFilePath?: string;
  extraTags: string[];
};

export const SUBJECT_IMPORT_DOCUMENTS: SubjectImportDocument[] = [
  {
    key: "obgyn-high-yield",
    subject: "Obstetrics & Gynecology",
    examCode: "IFOM_CSE",
    lessonTitle: "IFOM CSE OBGYN High-Yield Review",
    localFilePath: "/home/user/imports/IFOM_OBGYN_HighYield_CardiologyStyle_2.html",
    sourceFileName: "IFOM_OBGYN_HighYield_CardiologyStyle_2.html",
    kind: "html",
    description: "High-yield OBGYN study document prepared for IFOM-style review.",
    bundleFilePath: "/home/user/import_outputs/ifom_obgyn_high_yield.json",
    extraTags: ["IFOM CSE", "Obstetrics & Gynecology", "OBGYN", "GYN", "OBS"],
  },
  {
    key: "obgyn-repeated-practice",
    subject: "Obstetrics & Gynecology",
    examCode: "IFOM_CSE",
    lessonTitle: "OBGYN Repeated High-Yield Practice Bank",
    localFilePath: "/home/user/imports/GYN_OBS_some_repeated_and_high_yield_questions.html",
    sourceFileName: "GYN_OBS_some_repeated_and_high_yield_questions.html",
    kind: "html",
    description: "Repeated and high-yield OBGYN practice material converted into an in-app study document.",
    bundleFilePath: "/home/user/import_outputs/obgyn_repeated_high_yield.json",
    extraTags: ["IFOM CSE", "Obstetrics & Gynecology", "OBGYN", "GYN", "OBS"],
  },
  {
    key: "neurology-high-yield",
    subject: "Neurology",
    examCode: "IFOM_CSE",
    lessonTitle: "IFOM CSE Neurology High-Yield Review",
    localFilePath: "/home/user/imports/IFOM_Neurology_HighYield_2.html",
    sourceFileName: "IFOM_Neurology_HighYield_2.html",
    kind: "html",
    description: "Neurology high-yield review document for IFOM-style revision.",
    bundleFilePath: "/home/user/import_outputs/ifom_neurology_high_yield.json",
    extraTags: ["IFOM CSE", "Neurology"],
  },
  {
    key: "pediatrics-qbank-review",
    subject: "Pediatrics",
    examCode: "IFOM_CSE",
    lessonTitle: "IFOM CSE Pediatrics QBank Review",
    localFilePath: "/home/user/imports/Pediatrics_QBank_1.html",
    sourceFileName: "Pediatrics_QBank_1.html",
    kind: "html",
    description: "Pediatrics question-bank document preserved as an in-app study resource.",
    bundleFilePath: "/home/user/import_outputs/pediatrics_qbank.json",
    extraTags: ["IFOM CSE", "Pediatrics"],
  },
];
