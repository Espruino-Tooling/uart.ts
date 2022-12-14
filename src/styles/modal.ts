import jss from "jss";
import preset from "jss-preset-default";

jss.setup(preset());

const styles = {
  menu: {
    color: "#b2b2b2b",
    background: "white",
    padding: "10px 16px 10px 16px",
    fontWeight: "medium",
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
    border: "0.5px solid lightgray",
    "& .esp-tools-header-bar": {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      "& *": {
        margin: 0,
      },

      "& div": {
        cursor: "pointer",
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        "&:hover": {
          background: "rgba(0,0,0,0.05)",
        },
      },
    },
  },
  items: {
    color: "#000",
    background: "white",
    padding: "4px 8px 4px 8px",
    display: "grid",
    gridTemplateColumns: "fit-content(0)",
    gridTemplateRows: "fit-content(0)",
    borderBottomRightRadius: 7,
    borderBottomLeftRadius: 7,
    border: "0.5px solid lightgray",
    borderTop: 0,

    "& p": {
      content: "Select a connection method to pair your device",
      gridArea: "1 / 1 / 2 / 3",
      fontSize: 12,
      paddingLeft: 10,
      paddingTop: 5,
      margin: 0,
      color: "#7D7D7D",
    },
  },
  endpoints: {
    width: 100,
    height: 150,
    margin: "4px 0px 4px 0px",
    paddingLeft: 30,
    paddingRight: 30,
    borderRadius: 10,
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    textAlign: "center",
    alignItems: "center",
    justifyContent: "center",
    "&:hover": {
      background: "rgba(0,0,0,0.05)",
    },
    "& .esp-tools-icons": {
      width: 48,
      height: 48,
    },
    "& .esp-tools-name": {
      fontSize: 14,
      fontWeight: 500,
      paddingTop: 8,
      paddingBottom: 4,
    },
    "& .esp-tools-description": {
      fontWeight: 300,
      fontSize: 12,
      color: "#666",
    },
  },
};

export const { classes } = jss.createStyleSheet(styles).attach();
