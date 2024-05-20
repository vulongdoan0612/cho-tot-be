import jwt from "jsonwebtoken";

export const checkAccessToken = (req, res, next) => {
  // if (req.headers.authorization === undefined || req.cookies.accessToken === undefined) {
  //   return res.status(200).json({ message: "None-Account" });
  // }
  const accessToken = req.headers.authorization || req.cookies.accessToken;
  if (!accessToken) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const decoded = jwt.verify(accessToken, "VinalinkGroup!2020");
    req.user = decoded;
    next();
  } catch (error) {
    console.log(error);
    return res.status(401).json({ message: "Invalid AccessToken" });
  }
};
