import { describe, expect, it } from 'vitest';
import { EXAMPLE_RAMBLE } from '../moodboard';
import { normalizeProfile, parseProfileLocally, profileArtists } from '../profile';
import { tasteFrom } from '../scene';

/** The owner-trip persona's ramble from the 2026-09-24 red team (UFR2-F01, F02), word for word. */
const MATT =
  "I'm Matt, 44, from Atlanta. Die-hard Braves fan, we go to Truist Park a lot. Two boys, Jack is 12 and Sam is 8, and my wife Kelly. I love live rock, Foo Fighters, Pearl Jam, Tom Petty, and honestly a great cover band at a bar is my favorite night out. We loved a trip to Nashville a few years back for the honky tonks, and the beach at 30A. I'm into BBQ, craft beer and tacos. Kids are into baseball and roller coasters.";

const kids = (text: string) => parseProfileLocally(text).family.filter((member) => member.relation === 'child');

describe('UFR2-F01: the parser never invents children', () => {
  it('counts two boys once, even when "Kids" comes up later', () => {
    const found = kids(MATT);
    expect(found).toHaveLength(2);
    expect(found.map((kid) => [kid.name, kid.age])).toEqual([['Jack', 12], ['Sam', 8]]);
    expect(parseProfileLocally(MATT).summary).toContain('2 kids');
  });

  it('treats "the kids" as a reference once children exist', () => {
    expect(kids('I have two boys, 8 and 12. The kids love roller coasters.').map((kid) => kid.age)).toEqual([8, 12]);
    expect(kids('Two boys, 8 and 12. The kids love coasters.')).toHaveLength(2);
    expect(kids('We have two daughters. Our girls are 6 and 9.').map((kid) => kid.age)).toEqual([6, 9]);
    expect(kids('Two kids. My son Leo loves soccer.').map((kid) => kid.name)).toContain('Leo');
    expect(kids('Two kids. My son Leo loves soccer.')).toHaveLength(2);
  });

  it('marks a count taken from a bare plural as a guess', () => {
    const found = kids('We love beaches and snorkeling with the kids.');
    expect(found).toHaveLength(2);
    expect(found.every((kid) => kid.guessed)).toBe(true);
    expect(kids('Two boys, 8 and 12.').some((kid) => kid.guessed)).toBe(false);
  });
});

describe('UFR2-F02: name, age, hometown and artists from ordinary phrasing', () => {
  it('reads "I\'m Matt, 44, from Atlanta."', () => {
    const profile = parseProfileLocally("I'm Matt, 44, from Atlanta.");
    expect(profile).toMatchObject({ name: 'Matt', age: 44, hometown: 'Atlanta' });
  });

  it('reads the page’s own placeholder', () => {
    const profile = parseProfileLocally("I'm 44, from Atlanta. Braves fan. Two boys, 8 and 12…");
    expect(profile).toMatchObject({ age: 44, hometown: 'Atlanta' });
    expect(profile.family).toHaveLength(2);
  });

  it('reads a single-city "from" and "my name is"', () => {
    expect(parseProfileLocally("I'm from Atlanta.").hometown).toBe('Atlanta');
    expect(parseProfileLocally('i’m from Atlanta, GA and love jazz').hometown).toBe('Atlanta, GA');
    expect(parseProfileLocally('Originally from Porto, Portugal. Now we travel a lot.').hometown).toBe('Porto, Portugal');
    expect(parseProfileLocally('My name is Dana and I live in Lisbon.')).toMatchObject({ name: 'Dana', hometown: 'Lisbon' });
  });

  it('keeps a team out of the hometown and a nationality out of the name', () => {
    expect(parseProfileLocally("I'm from Atlanta, Braves fan forever.").hometown).toBe('Atlanta');
    expect(parseProfileLocally("I'm Brazilian and we live in Lisbon.").name).toBeUndefined();
  });

  it('captures named artists, conservatively', () => {
    expect(parseProfileLocally(MATT).artists).toEqual(['Foo Fighters', 'Pearl Jam', 'Tom Petty']);
    expect(parseProfileLocally('Foo Fighters, Pearl Jam, Tom Petty').artists).toEqual(['Foo Fighters', 'Pearl Jam', 'Tom Petty']);
    expect(parseProfileLocally('Our favorite bands are Goose, Billy Strings and Trey Anastasio.').artists).toEqual(['Goose', 'Billy Strings', 'Trey Anastasio']);
    // Places, teams, festivals and lowercase words are not artists.
    expect(parseProfileLocally('We saw shows in Nashville, Austin and New Orleans.').artists).toBeUndefined();
    expect(parseProfileLocally('Braves, Falcons and Hawks games, plus live music.').artists).toBeUndefined();
    expect(parseProfileLocally(EXAMPLE_RAMBLE).artists).toBeUndefined();
    expect(parseProfileLocally('I love Lisbon, Porto and Madrid.').artists).toBeUndefined();
    expect(parseProfileLocally('We hope to go in the future, it was a journey.').artists).toBeUndefined();
  });
});

describe('UFR2-H01: artists feed the music features', () => {
  it('survives normalizing and reaches the taste used by shows and scenes', () => {
    const profile = normalizeProfile({ artists: ['Pearl Jam', 'Pearl Jam', 'Tom Petty'], music: ['Rock'] });
    expect(profile.artists).toEqual(['Pearl Jam', 'Tom Petty']);
    expect(profileArtists(profile)).toEqual(['Pearl Jam', 'Tom Petty']);
    expect(tasteFrom(profile).topArtists).toEqual(['Pearl Jam', 'Tom Petty']);
    expect(normalizeProfile({}).artists).toBeUndefined();
  });
});
