import { Router, type IRouter } from "express";
import healthRouter from "./health";
import raiseClaimRouter from "./raise-claim";
import raisesRouter from "./raises";
import agentRaisesRouter from "./agent-raises";

const router: IRouter = Router();

router.use(healthRouter);
router.use(raiseClaimRouter);
router.use(raisesRouter);
router.use(agentRaisesRouter);

export default router;
