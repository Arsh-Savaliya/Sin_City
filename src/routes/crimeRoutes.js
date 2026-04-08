const express = require("express");
const controller = require("../controllers/crimeController");

const router = express.Router();

router.get("/", controller.list);
router.post("/", controller.create);
router.patch("/:id", controller.update);

module.exports = router;
