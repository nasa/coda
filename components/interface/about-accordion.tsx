import {
  Accordion,
  AccordionItem,
  AccordionItemHeading,
  AccordionItemButton,
  AccordionItemPanel,
} from "react-accessible-accordion";

/** CSS is at /public/accordion-styles.css */

export default function AboutAccordion() {
  return (
    <Accordion allowZeroExpanded={true} preExpanded={["links"]}>
      <AccordionItem uuid="links">
        <AccordionItemHeading>
          <AccordionItemButton>Useful Links</AccordionItemButton>
        </AccordionItemHeading>
        <AccordionItemPanel>
          <ul>
            <li>
              <a href={"https://wiki.jsc.nasa.gov/exploration/index.php/CODA"} target={"_blank"}>
                About CODA
              </a>
            </li>
            <li>
              <a
                href={"https://wiki.jsc.nasa.gov/exploration/index.php/EVA_Mission_System_Software"}
                target={"_blank"}
              >
                About the EMSS effort
              </a>
            </li>
            <li>
              <a
                href={"https://wiki.jsc.nasa.gov/fod/index.php/CODA/Awesome_Moments"}
                target={"_blank"}
              >
                CODA Links to awesome moments
              </a>
            </li>
          </ul>
        </AccordionItemPanel>
      </AccordionItem>
      <AccordionItem uuid="team">
        <AccordionItemHeading>
          <AccordionItemButton>The Team</AccordionItemButton>
        </AccordionItemHeading>
        <AccordionItemPanel>
          <ul>
            <li>
              <div className={"creditHeading"}>
                <a className={"teamName"} href={"mailto:benjamin.f.feist@nasa.gov"}>
                  Ben Feist
                </a>
              </div>
              <div>
                Concept, Software Engineering
                <br />{" "}
                <a className={"smallText"} href={"mailto:benjamin.f.feist@nasa.gov"}>
                  Email for help
                </a>
              </div>
            </li>
            <li>
              <div className={"creditHeading"}>
                <a className={"teamName"} href={"mailto:david.w.charney@nasa.gov"}>
                  David Charney
                </a>
              </div>
              <div>Interaction and Visual Design</div>
            </li>
            <li>
              <div className={"creditHeading"}>
                <a className={"teamName"} href={"mailto:cameron.w.pittman@nasa.gov"}>
                  Cameron Pittman
                </a>
              </div>
              <div>Software Architecture</div>
            </li>
            <li>
              <div className={"creditHeading"}>
                <a className={"teamName"} href={"mailto:edwin.j.montalvo@nasa.gov"}>
                  James Montalvo
                </a>
              </div>
              <div>EMSS Lead, Software Engineering</div>
            </li>
            <li>
              <div className={"creditHeading"}>
                <a className={"teamName"} href={"mailto:matthew.j.miller-1@nasa.gov"}>
                  Matthew Miller
                </a>
              </div>
              <div>Project Management</div>
            </li>
          </ul>
        </AccordionItemPanel>
      </AccordionItem>
    </Accordion>
  );
}
