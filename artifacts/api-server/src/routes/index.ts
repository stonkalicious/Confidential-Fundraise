import { Router, type IRouter } from "express";
import healthRouter from "./health";
import raiseClaimRouter from "./raise-claim";
import raisesRouter from "./raises";

const router: IRouter = Router();

router.use(healthRouter);
router.use(raiseClaimRouter);
router.use(raisesRouter);

export default router;
